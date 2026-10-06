import mqtt from 'mqtt'
import prisma from '../config/prisma.js'
import { MQTT_BROKER_URLS, MQTT_TOPICS, MQTT_CLIENT_ID } from '../config/index.js'
import { notifyKpiChanged } from './kpi.broadcaster.js'
import { ANDON_EVENT, broadcastAndonEvent } from './socket.service.js'

const VALID_RESULTS = ['OK', 'NG', 'REJECT']
const VALID_DOWNTIME = ['BREAKDOWN', 'SETUP', 'MATERIAL', 'MAINTENANCE', 'QUALITY', 'OTHER']

const EVENT_LABELS = {
  START_SHIFT: 'Start shift',
  SHOOT: 'Output OK (shoot)',
  INPUT_NG: 'Input NG',
  ABNORMALITY: 'Abnormality',
  BREAK: 'Break / downtime',
  PRODUCTION_SETUP: 'Production setup',
  FINISH_SHIFT: 'Finish shift',
}

const KNOWN_EVENTS = new Set(Object.keys(EVENT_LABELS))

const toInt = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? (Number.isInteger(n) ? n : Math.round(n)) : null
}

const pickEnum = (value, validList, fallback) => (validList.includes(value) ? value : fallback)

function buildNote(event, payload) {
  const parts = []

  if (payload.defectName) {
    parts.push(`Defect: ${payload.defectName}${payload.defectCode ? ` (${payload.defectCode})` : ''}`)
  }
  if (payload.abnormalityName) {
    parts.push(`Abnormality: ${payload.abnormalityName}${payload.abnormalityCode ? ` (${payload.abnormalityCode})` : ''}`)
  }

  if (parts.length) return parts.join('; ')
  return EVENT_LABELS[event] || event
}

function mapToProductionLog(event, payload) {
  const defaultResult = event === 'INPUT_NG' ? 'NG' : 'OK'

  const ts = payload.timestamp ? new Date(payload.timestamp) : new Date()
  const loggedAt = Number.isNaN(ts.getTime()) ? new Date() : ts

  return {
    workOrderId: toInt(payload.workOrderId),
    loggedAt,
    cycleTimeSeconds: toInt(payload.cycleTimeSeconds),
    result: pickEnum(payload.result, VALID_RESULTS, defaultResult),
    goodQty: toInt(payload.goodQty),
    ngQty: toInt(payload.ngQty),
    downtimeCategory: event === 'BREAK' ? pickEnum(payload.downtimeCategory, VALID_DOWNTIME, 'OTHER') : pickEnum(payload.downtimeCategory, VALID_DOWNTIME, null),
    downtimeMinutes: toInt(payload.downtimeMinutes),
    note: buildNote(event, payload),
  }
}

async function resolveWorkOrder(entry, payload) {
  if (entry.workOrderId) return entry.workOrderId

  if (payload.workOrderCode) {
    const workOrder = await prisma.workOrder.findUnique({ where: { code: payload.workOrderCode } })
    if (workOrder) return workOrder.id
  }
  return null
}

async function handleMessage(topic, message) {
  let payload
  try {
    payload = JSON.parse(message.toString())
  } catch {
    console.warn(`[ingest] Payload bukan JSON valid dari topik "${topic}": ${message.toString().slice(0, 200)}`)
    return
  }

  const event = payload.event
  if (!event) {
    console.warn(`[ingest] Payload tanpa field "event" diabaikan: ${message.toString().slice(0, 200)}`)
    return
  }
  if (!KNOWN_EVENTS.has(event)) {
    // Penting saat topik subscribe memakai wildcard: broker publik dipakai banyak
    // aplikasi, jadi pesan dari sistem lain akan masuk ke sini juga.
    console.warn(`[ingest] Event "${event}" tidak dikenal, dilewati (topik "${topic}")`)
    return
  }

  const entry = mapToProductionLog(event, payload)

  const workOrderId = await resolveWorkOrder(entry, payload)
  if (!workOrderId) {
    console.warn(
      `[ingest] Event "${event}" diabaikan karena workOrderId / workOrderCode tidak ditemukan (payload: ${message.toString().slice(0, 200)})`
    )
    return
  }
  entry.workOrderId = workOrderId

  try {
    const saved = await prisma.productionLog.create({ data: entry })
    console.log(
      `[ingest] Berhasil simpan log: ${JSON.stringify({
        productionLogId: saved.id,
        event,
        workOrderId,
        workOrderCode: payload.workOrderCode ?? null,
        machineId: payload.machineId ?? null,
        result: saved.result,
        goodQty: saved.goodQty,
        ngQty: saved.ngQty,
        downtimeCategory: saved.downtimeCategory,
        downtimeMinutes: saved.downtimeMinutes,
        loggedAt: saved.loggedAt.toISOString(),
      })}`
    )

    const trigger = {
      source: 'mqtt-ingest',
      topic,
      event,
      productionLogId: saved.id,
      workOrderId,
      result: saved.result,
      goodQty: saved.goodQty,
      ngQty: saved.ngQty,
      downtimeCategory: saved.downtimeCategory,
      downtimeMinutes: saved.downtimeMinutes,
      loggedAt: saved.loggedAt.toISOString(),
    }

    // Broadcast event mentah lebih dulu supaya UI bisa langsung bereaksi (mis. bunyi
    // alarm / flash kartu mesin) tanpa menunggu perhitungan KPI selesai.
    broadcastAndonEvent(ANDON_EVENT.LOG, {
      ...trigger,
      workOrderCode: payload.workOrderCode ?? null,
      machineId: payload.machineId ?? null,
      note: saved.note,
    })

    // Data baru sudah tersimpan -> memicu broadcast KPI realtime ke semua klien WebSocket
    notifyKpiChanged(trigger)
  } catch (err) {
    console.error(`[ingest] Gagal menyimpan ProductionLog untuk event "${event}": ${err.message}`)
  }
}

let client = null
let brokerIndex = 0
let status = 'disconnected'
let lastError = null

/**
 * Terjemahkan URL broker TCP (mqtt://host:1883) menjadi URL WebSocket yang bisa
 * dipakai browser (wss://host:8081/mqtt untuk Mosquitto, wss://host:8884/mqtt
 * untuk HiveMQ). Dipakai endpoint config supaya Operator Playground publish ke
 * broker yang sama dengan yang di-subscribe backend.
 */
const WS_PORTS = {
  'test.mosquitto.org': '8081/mqtt',
  'broker.hivemq.com': '8884/mqtt',
}

export const toWebSocketUrl = (brokerUrl) => {
  const withoutScheme = String(brokerUrl).replace(/^mqtts?:\/\//, '')
  const [host, port] = withoutScheme.split(':')
  if (!host) return null
  if (WS_PORTS[host]) return `wss://${host}:${WS_PORTS[host]}`
  return `ws://${host}:${port ?? '8081'}/mqtt`
}

const setStatus = (next, error = null) => {
  status = next
  lastError = error
}

export const getIngestStatus = () => ({
  status,
  broker: MQTT_BROKER_URLS[brokerIndex] ?? null,
  brokers: MQTT_BROKER_URLS,
  brokerWsUrl: toWebSocketUrl(MQTT_BROKER_URLS[brokerIndex] ?? ''),
  topics: MQTT_TOPICS,
  error: lastError,
})

const connectBroker = () => {
  const broker = MQTT_BROKER_URLS[brokerIndex]
  setStatus('connecting')

  client = mqtt.connect(broker, {
    clientId: `${MQTT_CLIENT_ID}-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    maxReconnectPeriod: 30000,
    reconnecting: true,
    keepalive: 60,
  })

  client.on('connect', () => {
    setStatus('connected')
    console.log(`[ingest] Terhubung ke MQTT ${broker}`)
    for (const topic of MQTT_TOPICS) {
      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) console.error(`[ingest] Gagal subscribe topik "${topic}": ${err.message}`)
        else console.log(`[ingest] Subscribe topik "${topic}"`)
      })
    }
  })

  client.on('reconnect', () => {
    console.log('[ingest] Broker tidak tersedia, mencoba koneksi ulang...')
  })

  client.on('error', (err) => {
    setStatus('error', err.message)
    console.error(`[ingest] Error MQTT (${broker}): ${err.message}`)
  })

  client.on('offline', () => {
    console.warn('[ingest] Koneksi MQTT offline')
  })

  client.on('close', () => {
    // Pindah ke broker berikutnya kalau ada, supaya public broker yang sedang
    // down tidak mematikan seluruh pipeline ingest.
    if (MQTT_BROKER_URLS.length > 1) {
      brokerIndex = (brokerIndex + 1) % MQTT_BROKER_URLS.length
      console.warn(`[ingest] Koneksi ditutup, beralih ke broker berikutnya: ${MQTT_BROKER_URLS[brokerIndex]}`)
      setStatus('connecting')
      try {
        client?.end(true)
      } catch {
        // abaikan, koneksi memang sudah tertutup
      }
      client = null
      setTimeout(() => {
        if (status !== 'connected') connectBroker()
      }, 2000)
    }
  })

  client.on('message', (topic, message) => {
    handleMessage(topic, message).catch((err) => {
      console.error('[ingest] Gagal memproses pesan:', err.message)
    })
  })

  return client
}

export const startIngest = () => {
  if (client) return client
  return connectBroker()
}

export const stopIngest = () => {
  setStatus('disconnected')
  if (client) {
    client.removeAllListeners()
    client.end(true)
    client = null
  }
}