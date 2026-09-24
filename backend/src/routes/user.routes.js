import express from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js'
import { readAccess, writeAccess } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', ...readAccess, getUsers)
router.get('/:id', ...readAccess, getUserById)
router.post('/', ...writeAccess, createUser)
router.put('/:id', ...writeAccess, updateUser)
router.delete('/:id', ...writeAccess, deleteUser)

export default router