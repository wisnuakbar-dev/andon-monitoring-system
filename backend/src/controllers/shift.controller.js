import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getShifts = asyncHandler(async (req, res) => {
  const shifts = await prisma.shift.findMany({
    include: { _count: { select: { productionSetup: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(shifts)
})

export const getShiftById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { productionSetup: true },
  })
  if (!shift) return res.status(404).json({ message: notFoundMessage('Shift') })
  res.json(shift)
})

export const createShift = asyncHandler(async (req, res) => {
  const { name, code, startTime, endTime, description } = req.body
  if (!name || !code || !startTime || !endTime) {
    return res.status(400).json({ message: 'name, code, startTime, dan endTime wajib diisi' })
  }
  const shift = await prisma.shift.create({ data: { name, code, startTime, endTime, description } })
  res.status(201).json(shift)
})

export const updateShift = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.shift.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Shift') })

  const { name, code, startTime, endTime, description } = req.body
  const shift = await prisma.shift.update({
    where: { id },
    data: { name, code, startTime, endTime, description },
  })
  res.json(shift)
})

export const deleteShift = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.shift.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Shift') })

  await prisma.shift.delete({ where: { id } })
  res.json({ message: 'Shift berhasil dihapus' })
})