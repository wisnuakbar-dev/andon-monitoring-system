import express from 'express'
import {
  getMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
} from '../controllers/machine.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getMachines)
router.get('/:id', ...readAccess, getMachineById)
router.post('/', ...writeAccess, createMachine)
router.put('/:id', ...writeAccess, updateMachine)
router.delete('/:id', ...writeAccess, deleteMachine)

export default router