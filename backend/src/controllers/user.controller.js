import bcrypt from 'bcryptjs'
import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  roleId: true,
  role: { select: { id: true, name: true, code: true } },
  createdAt: true,
  updatedAt: true,
}

export const getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { id: 'asc' },
  })
  res.json(users)
})

export const getUserById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const user = await prisma.user.findUnique({ where: { id }, select: userSelect })
  if (!user) return res.status(404).json({ message: notFoundMessage('User') })
  res.json(user)
})

export const createUser = asyncHandler(async (req, res) => {
  const { username, password, name, email, roleId } = req.body
  if (!username || !password || !name || !roleId) {
    return res.status(400).json({ message: 'username, password, name, dan roleId wajib diisi' })
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { username, password: hashedPassword, name, email, roleId: Number(roleId) },
    select: userSelect,
  })
  res.status(201).json(user)
})

export const updateUser = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.user.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('User') })

  const { username, password, name, email, roleId } = req.body
  const data = {
    username,
    name,
    email,
    roleId: roleId !== undefined ? Number(roleId) : undefined,
  }
  if (password) {
    data.password = await bcrypt.hash(password, 10)
  }

  const user = await prisma.user.update({ where: { id }, data, select: userSelect })
  res.json(user)
})

export const deleteUser = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.user.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('User') })

  await prisma.user.delete({ where: { id } })
  res.json({ message: 'User berhasil dihapus' })
})