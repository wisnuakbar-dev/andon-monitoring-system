import { getSocketStats } from '../services/socket.service.js'
import { getScopeSnapshot } from '../services/kpi.broadcaster.js'
import { getIngestStatus } from '../services/ingest.js'
import { ANDON_EVENT } from '../services/socket.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'

/** Snapshot KPI yang sama dengan payload WebSocket, untuk initial load / reconnect. */
export const getRealtimeKpi = asyncHandler(async (req, res) => {
  const snapshot = await getScopeSnapshot(req.query)
  res.json(snapshot)
})

/** Status WebSocket: jumlah klien terhubung dan scope KPI yang aktif. */
export const getRealtimeStatus = (req, res) => {
  res.json({ ...getSocketStats(), timestamp: new Date().toISOString() })
}

/**
 * Konfigurasi broker MQTT yang sedang dipakai backend. Operator Playground
 * mengambil nilai ini supaya publish ke broker + topik yang sama dengan yang
 * di-subscribe ingest. Endpoint publik (tanpa auth) supaya halaman login pun
 * tidak salah broker.
 */
export const getIngestConfig = (req, res) => {
  res.json({
    ...getIngestStatus(),
    events: ANDON_EVENT,
    timestamp: new Date().toISOString(),
  })
}