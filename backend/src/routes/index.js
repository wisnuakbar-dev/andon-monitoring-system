import express from 'express'
import authRoutes from './auth.routes.js'
import roleRoutes from './role.routes.js'
import userRoutes from './user.routes.js'
import shiftRoutes from './shift.routes.js'
import itemRoutes from './item.routes.js'
import machineRoutes from './machine.routes.js'
import abnormalityRoutes from './abnormality.routes.js'
import productionSetupRoutes from './production-setup.routes.js'
import defectRoutes from './defect.routes.js'
import workOrderRoutes from './work-order.routes.js'
import analyticsRoutes from './analytics.routes.js'
import productionLogRoutes from './production-log.routes.js'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/roles', roleRoutes)
router.use('/users', userRoutes)
router.use('/shifts', shiftRoutes)
router.use('/items', itemRoutes)
router.use('/machines', machineRoutes)
router.use('/abnormalities', abnormalityRoutes)
router.use('/production-setups', productionSetupRoutes)
router.use('/defects', defectRoutes)
router.use('/work-orders', workOrderRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/production-logs', productionLogRoutes)

export default router