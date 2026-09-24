import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
    orderBy: { id: 'asc' },
  })
  res.json(roles)
})

export const getRoleById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const role = await prisma.role.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      users: {
        select: { id: true, username: true, name: true, email: true, createdAt: true },
      },
    },
  })
  if (!role) return res.status(404).json({ message: notFoundMessage('Role') })
  res.json(role)
})

export const createRole = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body
  if (!name || !code) {
    return res.status(400).json({ message: 'name dan code wajib diisi' })
  }
  const role = await prisma.role.create({ data: { name, code, description } })
  res.status(201).json(role)
})

export const updateRole = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.role.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Role') })

  const { name, code, description } = req.body
  const role = await prisma.role.update({
    where: { id },
    data: { name, code, description },
  })
  res.json(role)
})

export const deleteRole = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.role.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Role') })

  await prisma.role.delete({ where: { id } })
  res.json({ message: 'Role berhasil dihapus' })
})