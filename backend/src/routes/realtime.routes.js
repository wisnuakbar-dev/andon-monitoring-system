import express from 'express'
import { getRealtimeKpi, getRealtimeStatus, getIngestConfig } from '../controllers/realtime.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = express.Router()

// Broker/topik MQTT aktif. Tidak butuh auth: dipakai Operator Playground untuk
// publish ke broker yang sama dengan backend, dan tidak memuat data sensitif.
router.get('/ingest-config', getIngestConfig)

// KPI live: boleh semua user yang sudah login (dashboard andon), bukan hanya Supervisor
router.get('/kpi', authenticate, getRealtimeKpi)
router.get('/status', authenticate, getRealtimeStatus)

export default router