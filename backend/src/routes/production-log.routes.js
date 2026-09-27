import express from 'express'
import { getProductionLogs } from '../controllers/production-log.controller.js'
import { readAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getProductionLogs)

export default router
