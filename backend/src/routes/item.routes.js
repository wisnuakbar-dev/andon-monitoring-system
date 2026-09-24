import express from 'express'
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/item.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getItems)
router.get('/:id', ...readAccess, getItemById)
router.post('/', ...writeAccess, createItem)
router.put('/:id', ...writeAccess, updateItem)
router.delete('/:id', ...writeAccess, deleteItem)

export default router