import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getDefects = asyncHandler(async (req, res) => {
  const defects = await prisma.defect.findMany({
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(defects)
})

export const getDefectById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const defect = await prisma.defect.findUnique({
    where: { id },
    include: { item: { select: { id: true, code: true, name: true } } },
  })
  if (!defect) return res.status(404).json({ message: notFoundMessage('Defect') })
  res.json(defect)
})

export const createDefect = asyncHandler(async (req, res) => {
  const { code, name, description, itemId } = req.body
  if (!code || !name || !itemId) {
    return res.status(400).json({ message: 'code, name, dan itemId wajib diisi' })
  }
  const defect = await prisma.defect.create({
    data: { code, name, description, itemId: Number(itemId) },
    include: { item: { select: { id: true, code: true, name: true } } },
  })
  res.status(201).json(defect)
})

export const updateDefect = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.defect.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Defect') })

  const { code, name, description, itemId } = req.body
  const defect = await prisma.defect.update({
    where: { id },
    data: {
      code,
      name,
      description,
      itemId: itemId !== undefined ? Number(itemId) : undefined,
    },
  })
  res.json(defect)
})

export const deleteDefect = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.defect.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Defect') })

  await prisma.defect.delete({ where: { id } })
  res.json({ message: 'Defect berhasil dihapus' })
})