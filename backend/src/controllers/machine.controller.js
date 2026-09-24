import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

export const getMachines = asyncHandler(async (req, res) => {
  const machines = await prisma.machine.findMany({
    include: { _count: { select: { abnormalities: true, productionSetup: true } } },
    orderBy: { id: 'asc' },
  })
  res.json(machines)
})

export const getMachineById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const machine = await prisma.machine.findUnique({
    where: { id },
    include: {
      abnormalities: true,
      productionSetup: { include: { item: true, shift: true } },
    },
  })
  if (!machine) return res.status(404).json({ message: notFoundMessage('Mesin') })
  res.json(machine)
})

export const createMachine = asyncHandler(async (req, res) => {
  const { code, name, location, isActive } = req.body
  if (!code || !name) {
    return res.status(400).json({ message: 'code dan name wajib diisi' })
  }
  const machine = await prisma.machine.create({
    data: { code, name, location, isActive: isActive ?? true },
  })
  res.status(201).json(machine)
})

export const updateMachine = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.machine.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Mesin') })

  const { code, name, location, isActive } = req.body
  const machine = await prisma.machine.update({
    where: { id },
    data: { code, name, location, isActive },
  })
  res.json(machine)
})

export const deleteMachine = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.machine.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('Mesin') })

  await prisma.machine.delete({ where: { id } })
  res.json({ message: 'Mesin berhasil dihapus' })
})