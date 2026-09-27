import prisma from '../config/prisma.js'
import { ANALYTICS_TIMEZONE } from '../config/index.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { resolveIdFilters, resolveRange, resolveTimeZone } from '../utils/dateRange.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500
const ID_KEYS = ['workOrderId', 'shiftId', 'machineId', 'itemId']

const VALID_RESULTS = ['OK', 'NG', 'REJECT']
const VALID_DOWNTIME = ['BREAKDOWN', 'SETUP', 'MATERIAL', 'MAINTENANCE', 'QUALITY', 'OTHER']

const logInclude = {
  workOrder: {
    select: {
      id: true,
      code: true,
      machine: { select: { id: true, code: true, name: true, location: true } },
      item: { select: { id: true, code: true, name: true } },
      shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
    },
  },
}

// Catatan defect ditulis ingest dengan format: "Defect: <nama> (<kode>)"
const DEFECT_NOTE = /Defect:\s*([^;(]+?)\s*\(\s*([^)]+?)\s*\)/

const decorate = (log) => {
  const match = log.note ? DEFECT_NOTE.exec(log.note) : null
  return {
    ...log,
    defectCode: match ? match[2] : null,
    defectName: match ? match[1] : null,
  }
}

const parsePaging = (rawPage, rawLimit) => {
  const page = Number.parseInt(rawPage, 10)
  const limit = Number.parseInt(rawLimit, 10)
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT,
  }
}

export const getProductionLogs = asyncHandler(async (req, res) => {
  const { timeZone, error: tzError } = resolveTimeZone(req.query.timezone, ANALYTICS_TIMEZONE)
  if (tzError) return res.status(400).json({ message: tzError })

  const { error: rangeError, ...range } = resolveRange({
    from: req.query.from,
    to: req.query.to,
    date: req.query.date,
    timeZone,
  })
  if (rangeError) return res.status(400).json({ message: rangeError })

  const { ids, error: idError } = resolveIdFilters(req.query, ID_KEYS)
  if (idError) return res.status(400).json({ message: idError })

  const results = req.query.result
    ? String(req.query.result)
        .toUpperCase()
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const invalidResult = results.find((value) => !VALID_RESULTS.includes(value))
  if (invalidResult) {
    return res.status(400).json({ message: `result tidak valid, gunakan: ${VALID_RESULTS.join(', ')}` })
  }

  const downtimeCategory = req.query.downtimeCategory
    ? String(req.query.downtimeCategory).toUpperCase()
    : null
  if (downtimeCategory && !VALID_DOWNTIME.includes(downtimeCategory)) {
    return res
      .status(400)
      .json({ message: `downtimeCategory tidak valid, gunakan: ${VALID_DOWNTIME.join(', ')}` })
  }

  // Kode defect disimpan di dalam catatan, dicocokkan dengan tanda kurung agar presisi
  const defectCode = req.query.defectCode ? String(req.query.defectCode).trim() : null
  const hasDowntime = String(req.query.hasDowntime || '') === 'true'
  const hasCycleTime = String(req.query.hasCycleTime || '') === 'true'

  const where = {
    loggedAt: { gte: range.from, lt: range.toExclusive },
    ...(ids.workOrderId ? { workOrderId: ids.workOrderId } : {}),
    ...(ids.shiftId || ids.machineId || ids.itemId
      ? {
          workOrder: {
            is: {
              ...(ids.shiftId ? { shiftId: ids.shiftId } : {}),
              ...(ids.machineId ? { machineId: ids.machineId } : {}),
              ...(ids.itemId ? { itemId: ids.itemId } : {}),
            },
          },
        }
      : {}),
    ...(results.length === 1 ? { result: results[0] } : results.length > 1 ? { result: { in: results } } : {}),
    ...(downtimeCategory ? { downtimeCategory } : {}),
    ...(defectCode ? { note: { contains: `(${defectCode})` } } : {}),
    ...(hasDowntime ? { downtimeMinutes: { gt: 0 } } : {}),
    ...(hasCycleTime ? { cycleTimeSeconds: { not: null } } : {}),
  }

  const { page, limit } = parsePaging(req.query.page, req.query.limit)

  const [total, logs] = await Promise.all([
    prisma.productionLog.count({ where }),
    prisma.productionLog.findMany({
      where,
      include: logInclude,
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    data: logs.map(decorate),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      from: range.from.toISOString(),
      to: range.toExclusive.toISOString(),
      timezone: timeZone,
    },
  })
})
