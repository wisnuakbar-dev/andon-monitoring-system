import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getAbnormalities = asyncHandler(async (req, res) => {
  const abnormalities = await prisma.abnormality.findMany({
    include: { machine: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(abnormalities)
})

export const getAbnormalityById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const abnormality = await prisma.abnormality.findUnique({
    where: { id },
    include: { machine: { select: { id: true, code: true, name: true } } },
  })
  if (!abnormality) return res.status(404).json({ message: notFoundMessage('Abnormality') })
  res.json(abnormality)
})

export const createAbnormality = asyncHandler(async (req, res) => {
  const { code, name, description, machineId } = req.body
  if (!code || !name || !machineId) {
    return res.status(400).json({ message: 'code, name, dan machineId wajib diisi' })
  }
  const abnormality = await prisma.abnormality.create({
    data: { code, name, description, machineId: Number(machineId) },
    include: { machine: { select: { id: true, code: true, name: true } } },
  })
  res.status(201).json(abnormality)
})

export const updateAbnormality = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.abnormality.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Abnormality') })

  const { code, name, description, machineId } = req.body
  const abnormality = await prisma.abnormality.update({
    where: { id },
    data: {
      code,
      name,
      description,
      machineId: machineId !== undefined ? Number(machineId) : undefined,
    },
  })
  res.json(abnormality)
})

export const deleteAbnormality = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.abnormality.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Abnormality') })

  await prisma.abnormality.delete({ where: { id } })
  res.json({ message: 'Abnormality berhasil dihapus' })
})