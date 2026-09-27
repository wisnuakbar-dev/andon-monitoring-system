import express from 'express'
import { getAnalyticsSummaryHandler } from '../controllers/analytics.controller.js'
import { readAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/summary', ...readAccess, getAnalyticsSummaryHandler)

export default router
