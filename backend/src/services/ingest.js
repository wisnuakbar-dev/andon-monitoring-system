import mqtt from 'mqtt'
import prisma from '../config/prisma.js'
import { MQTT_BROKER_URL, MQTT_TOPIC, MQTT_CLIENT_ID } from '../config/index.js'
import { notifyKpiChanged } from './kpi.broadcaster.js'

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
      `[ingest] ProductionLog #${saved.id} tersimpan: ${event} | WO ${workOrderId} | result=${entry.result} | good=${entry.goodQty ?? 0} | ng=${entry.ngQty ?? 0}`
    )

    // Data baru sudah tersimpan -> memicu broadcast KPI realtime ke semua klien WebSocket
    notifyKpiChanged({
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
    })
  } catch (err) {
    console.error(`[ingest] Gagal menyimpan ProductionLog untuk event "${event}": ${err.message}`)
  }
}

let client = null

export const startIngest = () => {
  if (client) return client

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `${MQTT_CLIENT_ID}-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    keepalive: 60,
  })

  client.on('connect', () => {
    console.log(`[ingest] Terhubung ke MQTT ${MQTT_BROKER_URL}, subscribe topik "${MQTT_TOPIC}"`)
    client.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
      if (err) console.error(`[ingest] Gagal subscribe topik "${MQTT_TOPIC}": ${err.message}`)
    })
  })

  client.on('reconnect', () => {
    console.log('[ingest] Broker tidak tersedia, mencoba koneksi ulang...')
  })

  client.on('error', (err) => {
    console.error(`[ingest] Error MQTT: ${err.message}`)
  })

  client.on('close', () => {
    console.warn('[ingest] Koneksi MQTT tertutup')
  })

  client.on('message', (topic, message) => {
    handleMessage(topic, message).catch((err) => {
      console.error('[ingest] Gagal memproses pesan:', err.message)
    })
  })

  return client
}

export const stopIngest = () => {
  if (client) {
    client.end(true)
    client = null
  }
}