import prisma from '../config/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parseId, notFoundMessage } from '../utils/parseId.js'

const workOrderInclude = {
  shift: true,
  machine: { select: { id: true, code: true, name: true, location: true } },
  item: { select: { id: true, code: true, name: true } },
  _count: { select: { productionLogs: true } },
}

export const getWorkOrders = asyncHandler(async (req, res) => {
  const { type, approvalStatus } = req.query

  const where = {
    ...(type ? { type } : {}),
    ...(approvalStatus ? { approvalStatus } : {}),
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: workOrderInclude,
    orderBy: { createdAt: 'desc' },
  })
  res.json(workOrders)
})

export const getWorkOrderById = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      shift: true,
      machine: { select: { id: true, code: true, name: true, location: true } },
      item: { select: { id: true, code: true, name: true } },
      productionLogs: { orderBy: { loggedAt: 'desc' } },
    },
  })
  if (!workOrder) return res.status(404).json({ message: notFoundMessage('WorkOrder') })
  res.json(workOrder)
})

export const createWorkOrder = asyncHandler(async (req, res) => {
  const {
    code,
    type,
    approvalStatus,
    description,
    targetQuantity,
    scheduledDate,
    dueDate,
    shiftId,
    machineId,
    itemId,
  } = req.body

  if (!code || !shiftId || !machineId || !itemId) {
    return res.status(400).json({ message: 'code, shiftId, machineId, dan itemId wajib diisi' })
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      code,
      type,
      approvalStatus,
      description,
      targetQuantity: targetQuantity !== undefined ? Number(targetQuantity) : undefined,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      shiftId: Number(shiftId),
      machineId: Number(machineId),
      itemId: Number(itemId),
    },
    include: workOrderInclude,
  })
  res.status(201).json(workOrder)
})

export const updateWorkOrder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.workOrder.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('WorkOrder') })

  const {
    code,
    type,
    approvalStatus,
    description,
    targetQuantity,
    scheduledDate,
    dueDate,
    shiftId,
    machineId,
    itemId,
  } = req.body

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      code,
      type,
      approvalStatus,
      description,
      targetQuantity: targetQuantity !== undefined ? Number(targetQuantity) : undefined,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : scheduledDate === null ? null : undefined,
      dueDate: dueDate ? new Date(dueDate) : dueDate === null ? null : undefined,
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,
      machineId: machineId !== undefined ? Number(machineId) : undefined,
      itemId: itemId !== undefined ? Number(itemId) : undefined,
    },
    include: workOrderInclude,
  })
  res.json(workOrder)
})

export const deleteWorkOrder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.workOrder.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('WorkOrder') })

  const logCount = await prisma.productionLog.count({ where: { workOrderId: id } })
  if (logCount > 0) {
    return res.status(409).json({ message: 'WorkOrder memiliki log produksi, tidak bisa dihapus' })
  }

  await prisma.workOrder.delete({ where: { id } })
  res.json({ message: 'WorkOrder berhasil dihapus' })
})

export const approveWorkOrder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.workOrder.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('WorkOrder') })

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: { approvalStatus: 'APPROVED' },
    include: workOrderInclude,
  })
  res.json(workOrder)
})

export const rejectWorkOrder = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const exists = await prisma.workOrder.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('WorkOrder') })

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: { approvalStatus: 'REJECTED' },
    include: workOrderInclude,
  })
  res.json(workOrder)
})

export const updateWorkOrderStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const { approvalStatus } = req.body
  if (!approvalStatus) {
    return res.status(400).json({ message: 'approvalStatus wajib diisi' })
  }

  if (!['DRAFT', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
    return res.status(400).json({ message: 'approvalStatus tidak valid' })
  }

  const exists = await prisma.workOrder.findUnique({ where: { id } })
  if (!exists) return res.status(404).json({ message: notFoundMessage('WorkOrder') })

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: { approvalStatus },
    include: workOrderInclude,
  })
  res.json(workOrder)
})