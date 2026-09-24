import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

const setupInclude = {
  shift: true,
  machine: { select: { id: true, code: true, name: true, location: true } },
  item: { select: { id: true, code: true, name: true } },
  operator: {
    select: { id: true, username: true, name: true, email: true, role: { select: { code: true } } },
  },
}

export const getProductionSetups = asyncHandler(async (req, res) => {
  const productionSetups = await prisma.productionSetup.findMany({
    include: setupInclude,
    orderBy: { id: 'desc' },
  })
  res.json(productionSetups)
})

export const getProductionSetupById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const productionSetup = await prisma.productionSetup.findUnique({
    where: { id },
    include: setupInclude,
  })
  if (!productionSetup) return res.status(404).json({ message: notFoundMessage('ProductionSetup') })
  res.json(productionSetup)
})

export const createProductionSetup = asyncHandler(async (req, res) => {
  const { code, shiftId, machineId, itemId, operatorId, targetQuantity, startedAt, endedAt, status } =
    req.body

  if (!code || !shiftId || !machineId || !itemId || !operatorId) {
    return res.status(400).json({ message: 'code, shiftId, machineId, itemId, dan operatorId wajib diisi' })
  }

  const productionSetup = await prisma.productionSetup.create({
    data: {
      code,
      shiftId: Number(shiftId),
      machineId: Number(machineId),
      itemId: Number(itemId),
      operatorId: Number(operatorId),
      targetQuantity: targetQuantity !== undefined ? Number(targetQuantity) : undefined,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      endedAt: endedAt ? new Date(endedAt) : undefined,
      status,
    },
    include: setupInclude,
  })
  res.status(201).json(productionSetup)
})

export const updateProductionSetup = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.productionSetup.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('ProductionSetup') })

  const { code, shiftId, machineId, itemId, operatorId, targetQuantity, startedAt, endedAt, status } =
    req.body

  const productionSetup = await prisma.productionSetup.update({
    where: { id },
    data: {
      code,
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,
      machineId: machineId !== undefined ? Number(machineId) : undefined,
      itemId: itemId !== undefined ? Number(itemId) : undefined,
      operatorId: operatorId !== undefined ? Number(operatorId) : undefined,
      targetQuantity: targetQuantity !== undefined ? Number(targetQuantity) : undefined,
      startedAt: startedAt ? new Date(startedAt) : startedAt === null ? null : undefined,
      endedAt: endedAt ? new Date(endedAt) : endedAt === null ? null : undefined,
      status,
    },
    include: setupInclude,
  })
  res.json(productionSetup)
})

export const deleteProductionSetup = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.productionSetup.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('ProductionSetup') })

  await prisma.productionSetup.delete({ where: { id } })
  res.json({ message: 'ProductionSetup berhasil dihapus' })
})