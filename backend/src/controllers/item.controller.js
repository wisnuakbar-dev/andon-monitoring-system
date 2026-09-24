import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getItems = asyncHandler(async (req, res) => {
  const items = await prisma.item.findMany({
    include: {
      _count: { select: { defects: true, productionSetup: true } },
    },
    orderBy: { id: 'asc' },
  })
  res.json(items)
})

export const getItemById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const item = await prisma.item.findUnique({
    where: { id },
    include: { defects: true, productionSetup: true },
  })
  if (!item) return res.status(404).json({ message: notFoundMessage('Item') })
  res.json(item)
})

export const createItem = asyncHandler(async (req, res) => {
  const { code, name, description } = req.body
  if (!code || !name) {
    return res.status(400).json({ message: 'code dan name wajib diisi' })
  }
  const item = await prisma.item.create({ data: { code, name, description } })
  res.status(201).json(item)
})

export const updateItem = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.item.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Item') })

  const { code, name, description } = req.body
  const item = await prisma.item.update({ where: { id }, data: { code, name, description } })
  res.json(item)
})

export const deleteItem = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.item.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Item') })

  await prisma.item.delete({ where: { id } })
  res.json({ message: 'Item berhasil dihapus' })
})