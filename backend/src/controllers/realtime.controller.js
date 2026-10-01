import { getSocketStats } from '../services/socket.service.js'
import { getScopeSnapshot } from '../services/kpi.broadcaster.js'
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