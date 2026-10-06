import express from 'express'
import {
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  approveWorkOrder,
  rejectWorkOrder,
  updateWorkOrderStatus,
} from '../controllers/work-order.controller.js'
import { readAccess, writeAccess, approvalAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getWorkOrders)
router.get('/:id', ...readAccess, getWorkOrderById)
router.post('/', ...writeAccess, createWorkOrder)
router.put('/:id', ...writeAccess, updateWorkOrder)
router.patch('/:id/approve', ...approvalAccess, approveWorkOrder)
router.patch('/:id/reject', ...approvalAccess, rejectWorkOrder)
router.patch('/:id/status', ...approvalAccess, updateWorkOrderStatus)
router.delete('/:id', ...writeAccess, deleteWorkOrder)

export default router