import express from 'express'
import { getRealtimeKpi, getRealtimeStatus } from '../controllers/realtime.controller.js'
import { authenticate } from '../middleware/auth.middleware.js'

const router = express.Router()

// KPI live: boleh semua user yang sudah login (dashboard andon), bukan hanya Supervisor
router.get('/kpi', authenticate, getRealtimeKpi)
router.get('/status', authenticate, getRealtimeStatus)

export default router