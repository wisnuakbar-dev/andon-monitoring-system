import express from 'express'
import {
  getDefects,
  getDefectById,
  createDefect,
  updateDefect,
  deleteDefect,
} from '../controllers/defect.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getDefects)
router.get('/:id', ...readAccess, getDefectById)
router.post('/', ...writeAccess, createDefect)
router.put('/:id', ...writeAccess, updateDefect)
router.delete('/:id', ...writeAccess, deleteDefect)

export default router