import express from 'express'
import {
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
} from '../controllers/work-order.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getWorkOrders)
router.get('/:id', ...readAccess, getWorkOrderById)
router.post('/', ...writeAccess, createWorkOrder)
router.put('/:id', ...writeAccess, updateWorkOrder)
router.delete('/:id', ...writeAccess, deleteWorkOrder)

export default router