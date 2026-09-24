import express from 'express'
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/role.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getRoles)
router.get('/:id', ...readAccess, getRoleById)
router.post('/', ...writeAccess, createRole)
router.put('/:id', ...writeAccess, updateRole)
router.delete('/:id', ...writeAccess, deleteRole)

export default router