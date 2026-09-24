import express from 'express'
import {
  getProductionSetups,
  getProductionSetupById,
  createProductionSetup,
  updateProductionSetup,
  deleteProductionSetup,
} from '../controllers/production-setup.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getProductionSetups)
router.get('/:id', ...readAccess, getProductionSetupById)
router.post('/', ...writeAccess, createProductionSetup)
router.put('/:id', ...writeAccess, updateProductionSetup)
router.delete('/:id', ...writeAccess, deleteProductionSetup)

export default router