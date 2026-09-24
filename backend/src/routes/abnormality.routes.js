import express from 'express'
import {
  getAbnormalities,
  getAbnormalityById,
  createAbnormality,
  updateAbnormality,
  deleteAbnormality,
} from '../controllers/abnormality.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getAbnormalities)
router.get('/:id', ...readAccess, getAbnormalityById)
router.post('/', ...writeAccess, createAbnormality)
router.put('/:id', ...writeAccess, updateAbnormality)
router.delete('/:id', ...writeAccess, deleteAbnormality)

export default router