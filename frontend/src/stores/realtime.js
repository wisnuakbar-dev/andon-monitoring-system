import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

// Default diarahkan ke origin yang sama supaya lewat proxy Vite /socket.io.
// Set VITE_SOCKET_URL=http://localhost:3000 untuk connects langsung ke backend.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined

const KPI_EVENT = {
  SNAPSHOT: 'kpi:snapshot',
  UPDATE: 'kpi:update',
  ERROR: 'kpi:error',
}

// Parameter scope yang dikenali backend: sama untuk GET /realtime/kpi dan event "kpi:subscribe".
const SCOPE_KEYS = ['rangeDays', 'timezone', 'shiftId', 'machineId', 'itemId', 'workOrderId']

/** Buang nilai kosong supaya tidak terkirim sebagai query string sia-sia. */
const cleanScope = (scope = {}) => {
  const params = {}
  for (const key of SCOPE_KEYS) {
    const value = scope[key]
    if (value === undefined || value === null || value === '') continue
    params[key] = value
  }
  return params
}

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback

export const useRealtimeStore = defineStore('realtime', {
  state: () => ({
    client: null,
    status: 'idle',
    error: null,
    snapshot: null,
    scope: {},
    scopeKey: '',
    trigger: null,
    receivedAt: null,
    updateCount: 0,
    lastEventAt: null,
    loading: false,
    // Request REST yang masih berjalan; snapshot terakhir yang tiba tetap dipakai
    // sehingga papan andon tidak ikut kosong saat filter diganti.
    restPending: 0,
    restRequestId: 0,
  }),

  getters: {
    isConnected: (state) => state.status === 'connected',
    isLive: (state) => state.status === 'connected' && !!state.snapshot,
    hasData: (state) => !!state.snapshot,
    // true hanya selama benar-benar belum ada data sama sekali.
    isBootstrapping: (state) => state.loading && !state.snapshot,
  },

  actions: {
    setScope(scope = {}) {
      this.scope = cleanScope(scope)
      this.scopeKey = JSON.stringify(this.scope)
    },

    /** Satu pintu masuk untuk snapshot, baik dari REST maupun dari WebSocket. */
    applySnapshot(snapshot, trigger = null) {
      if (!snapshot) return
      this.snapshot = snapshot
      this.receivedAt = new Date().toISOString()
      if (trigger) {
        this.trigger = trigger
        this.lastEventAt = trigger.loggedAt ?? this.receivedAt
        this.updateCount += 1
      }
      // Data sudah ada, jadi layar "Menyiapkan data realtime..." langsung hilang
      // walau masih ada request REST lain yang belum selesai.
      if (this.restPending === 0) this.loading = false
    },

    /**
     * Ambil snapshot lewat REST. Dipakai untuk initial load dan sebagai cadangan
     * saat WebSocket tidak tersambung, sehingga papan andon tidak bergantung
     * penuh pada handshake socket.
     */
    async fetchSnapshot(scope = this.scope) {
      const params = cleanScope(scope)
      const requestId = ++this.restRequestId
      this.restPending += 1

      try {
        const { data } = await api.get('/realtime/kpi', { params })
        // Abaikan respons yang sudah basi karena scope diganti lagi.
        if (requestId !== this.restRequestId) return
        this.error = null
        this.applySnapshot(data)
      } catch (err) {
        if (requestId !== this.restRequestId) return
        // 401 sudah ditangani interceptor (logout + redirect ke /login).
        if (err?.response?.status !== 401) {
          this.error = errorMessage(err, 'Gagal memuat data realtime')
        }
      } finally {
        this.restPending = Math.max(0, this.restPending - 1)
        // Request terakhir sudah selesai (sukses maupun gagal) -> hentikan loading.
        if (this.restPending === 0) this.loading = false
      }
    },

    /** Buka koneksi Socket.IO + langganan scope KPI yang dipilih. */
    connect(scope = {}) {
      this.teardown()
      this.setScope(scope)

      this.trigger = null
      this.receivedAt = null
      this.updateCount = 0
      this.lastEventAt = null
      this.error = null

      const auth = useAuthStore()
      if (!auth.token) {
        this.status = 'unauthorized'
        this.loading = false
        this.error = 'Sesi tidak ditemukan. Silakan login kembali.'
        return
      }

      this.status = 'connecting'
      this.loading = true

      // Initial load lewat REST supaya dashboard langsung terisi; WebSocket
      // hanya menangani pembaruan berikutnya.
      this.fetchSnapshot(scope)

      this.client = io(SOCKET_URL, {
        // Token dibaca dari authStore Pinia dan dikirim saat handshake.
        auth: { token: auth.token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
      })

      this.client.on('connect', () => {
        this.status = 'connected'
        this.subscribe(this.scope)
      })

      this.client.on('disconnect', (reason) => {
        this.status = 'reconnecting'
        if (reason === 'io server disconnect') this.client?.connect()
      })

      this.client.on('connect_error', (err) => {
        const message = err?.message || 'Gagal terhubung ke server realtime'
        // Jangan diubah jadi error fatal: REST tetap bisa jadi sumber data.
        this.status = /token|auth|unauthorized|sesi/i.test(message) ? 'unauthorized' : 'error'
        this.error = message
        if (this.restPending === 0) this.loading = false
      })

      this.client.on(KPI_EVENT.SNAPSHOT, (payload) => {
        this.applySnapshot(payload?.snapshot)
      })

      this.client.on(KPI_EVENT.UPDATE, (payload) => {
        this.applySnapshot(payload?.snapshot, payload?.trigger)
      })

      this.client.on(KPI_EVENT.ERROR, (payload) => {
        this.error = payload?.message || 'Gagal menghitung KPI terbaru'
      })
    },

    /** Ganti filter papan (scope) tanpa memutus koneksi. */
    subscribe(scope = {}) {
      this.setScope(scope)

      if (!this.client?.connected) {
        // Tanpa socket, REST yang menutupi perubahan filter.
        this.fetchSnapshot(this.scope)
        return
      }

      this.loading = !this.snapshot
      this.client.emit('kpi:subscribe', this.scope)
    },

    async refresh() {
      this.client?.emit('kpi:refresh')
      await this.fetchSnapshot(this.scope)
    },

    teardown() {
      if (this.client) {
        this.client.removeAllListeners()
        this.client.disconnect()
        this.client = null
      }
    },

    reset() {
      this.teardown()
      // Naikkan id supaya request REST yang masih berjalan diabaikan.
      this.restRequestId += 1
      this.status = 'idle'
      this.error = null
      this.snapshot = null
      this.scope = {}
      this.scopeKey = ''
      this.trigger = null
      this.receivedAt = null
      this.updateCount = 0
      this.lastEventAt = null
      this.loading = false
      this.restPending = 0
    },
  },
})
