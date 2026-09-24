import express from 'express'
import {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
} from '../controllers/shift.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getShifts)
router.get('/:id', ...readAccess, getShiftById)
router.post('/', ...writeAccess, createShift)
router.put('/:id', ...writeAccess, updateShift)
router.delete('/:id', ...writeAccess, deleteShift)

export default router