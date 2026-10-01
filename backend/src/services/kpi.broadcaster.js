import { KPI_BROADCAST_DEBOUNCE_MS } from '../config/index.js'
import { getKpiSnapshot, resolveKpiScope, sanitizeScopeParams } from './kpi.service.js'
import {
  activeScopes,
  emitToScope,
  emitToSocket,
  getIo,
  setSocketScopes,
  subscriberCount,
} from './socket.service.js'

export const KPI_EVENT = {
  SNAPSHOT: 'kpi:snapshot',
  UPDATE: 'kpi:update',
  ERROR: 'kpi:error',
}

// Snapshot hasil broadcast dipakai ulang untuk klien yang baru subscribe,
// selama tidak lebih tua dari TTL ini.
const SNAPSHOT_TTL_MS = 10000

// scopeKey -> { timer, scope, params, snapshot, computedAt, trigger, running, dirty }
const scopeStates = new Map()

const stateFor = (scopeKey) => {
  const state = scopeStates.get(scopeKey)
  if (state) return state
  const fresh = { timer: null, scope: null, params: {}, snapshot: null, computedAt: 0, trigger: null, running: false, dirty: false }
  scopeStates.set(scopeKey, fresh)
  return fresh
}

const mergeTrigger = (previous, next) => {
  if (!next) return previous
  if (!previous) return next
  return {
    ...previous,
    ...next,
    count: (previous.count ?? 1) + (next.count ?? 1),
  }
}


const flush = async (scopeKey) => {
  const state = stateFor(scopeKey)
  state.timer = null
  if (subscriberCount(scopeKey) === 0) {
    scopeStates.delete(scopeKey)
    return
  }

  state.running = true
  const trigger = state.trigger ?? { source: 'schedule' }
  state.trigger = null

  try {
    // Rentang relatif ("7 hari terakhir") digeser ulang tiap broadcast
    const { scope, error } = resolveKpiScope(state.params)
    if (error) throw new Error(error)
    state.scope = scope

    const snapshot = await getKpiSnapshot(scope)
    state.snapshot = snapshot
    state.computedAt = Date.now()
    emitToScope(scopeKey, KPI_EVENT.UPDATE, { trigger, snapshot })
    console.log(`[kpi] Broadcast "${KPI_EVENT.UPDATE}" ke ${subscriberCount(scopeKey)} klien (${trigger.source})`)
  } catch (err) {
    console.error(`[kpi] Gagal menghitung KPI untuk scope ${scopeKey}: ${err.message}`)
    emitToScope(scopeKey, KPI_EVENT.ERROR, { message: 'Gagal menghitung KPI terbaru', trigger })
  } finally {
    state.running = false
    // Data baru masuk selagi perhitungan berjalan -> hitung ulang setelah selesai
    if (state.dirty) {
      state.dirty = false
      scheduleFlush(scopeKey)
    } else if (subscriberCount(scopeKey) === 0) {
      scopeStates.delete(scopeKey)
    }
  }
}

/**
 * Broadcast tertunda (debounce) supaya burst pesan MQTT yang beruntun
 * hanya memicu satu perhitungan KPI dan satu emit per scope.
 */
const scheduleFlush = (scopeKey, trigger) => {
  const state = stateFor(scopeKey)
  state.trigger = mergeTrigger(state.trigger, trigger)

  if (state.running) {
    state.dirty = true
    return
  }

  if (state.timer) return

  state.timer = setTimeout(() => {
    flush(scopeKey).catch((err) => console.error(`[kpi] Broadcast gagal: ${err.message}`))
  }, KPI_BROADCAST_DEBOUNCE_MS)
  state.timer.unref?.()
}

/**
 * Dipanggil setiap kali layanan MQTT Ingest berhasil menulis data baru ke database.
 * Semua scope yang sedang punya pendengar langsung menerima KPI terbaru.
 */
export const notifyKpiChanged = (trigger = { source: 'unknown' }) => {
  for (const scopeKey of activeScopes()) scheduleFlush(scopeKey, trigger)
}

const subscribe = async (socket, params) => {
  const { scope, key, error } = resolveKpiScope(params ?? {})
  if (error) return emitToSocket(socket, KPI_EVENT.ERROR, { message: error })

  setSocketScopes(socket, [key])
  const state = stateFor(key)
  state.scope = scope
  state.params = sanitizeScopeParams(params ?? {})

  const fresh = state.snapshot && Date.now() - state.computedAt < SNAPSHOT_TTL_MS
  const snapshot = fresh ? state.snapshot : await getKpiSnapshot(scope)
  state.snapshot = snapshot
  state.computedAt = Date.now()

  emitToSocket(socket, KPI_EVENT.SNAPSHOT, { scope: key, snapshot })
  return undefined
}

const refresh = async (socket) => {
  const scopeKey = socket.data.scopeKeys?.[0]
  if (!scopeKey) return emitToSocket(socket, KPI_EVENT.ERROR, { message: 'Kirim "kpi:subscribe" terlebih dahulu' })

  const state = stateFor(scopeKey)
  try {
    const { scope, error } = resolveKpiScope(state.params)
    if (error) throw new Error(error)
    const snapshot = await getKpiSnapshot(scope)
    state.scope = scope
    state.snapshot = snapshot
    state.computedAt = Date.now()
    emitToSocket(socket, KPI_EVENT.SNAPSHOT, { scope: scopeKey, snapshot })
  } catch (err) {
    emitToSocket(socket, KPI_EVENT.ERROR, { message: err.message })
  }
  return undefined
}

/** Daftarkan handler socket.io untuk seluruh siklus push KPI. */
export const attachKpiRealtime = () => {
  const io = getIo()
  if (!io) return

  io.on('connection', (socket) => {
    socket.on('kpi:subscribe', (params) => {
      subscribe(socket, params).catch((err) => {
        console.error(`[kpi] Gagal subscribe socket ${socket.id}: ${err.message}`)
        emitToSocket(socket, KPI_EVENT.ERROR, { message: err.message })
      })
    })

    socket.on('kpi:refresh', () => {
      refresh(socket).catch((err) => console.error(`[kpi] Refresh gagal: ${err.message}`))
    })
  })
}

export const getScopeSnapshot = async (params) => {
  const { scope, error } = resolveKpiScope(params ?? {})
  if (error) {
    const err = new Error(error)
    err.status = 400
    throw err
  }
  return getKpiSnapshot(scope)
}

export const stopKpiBroadcaster = () => {
  for (const state of scopeStates.values()) {
    if (state.timer) clearTimeout(state.timer)
    state.timer = null
  }
  scopeStates.clear()
}