import { Prisma } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ANALYTICS_TIMEZONE } from '../config/index.js'
import { isValidTimeZone, startOfZonedDay, zonedParts, zonedTimeToDate } from '../utils/zonedTime.js'

const MAX_RANGE_DAYS = 366
const VITAL_FEW_THRESHOLD = 80
const BUCKET_PARETO_LIMIT = 5

const round2 = (value) => Math.round(value * 100) / 100
export const percentage = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0)

const parseClock = (value) => {
  const [hour, minute] = String(value ?? '')
    .split(':')
    .map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

// Shift yang melewati tengah malam (mis. 23:00 - 07:00) dihitung 8 jam
export const shiftDurationMinutes = (startTime, endTime) => {
  const start = parseClock(startTime)
  const end = parseClock(endTime)
  if (start === null || end === null) return null
  const diff = end - start
  return diff > 0 ? diff : diff + 24 * 60
}

export const emptyMetrics = () => ({
  logCount: 0,
  okQty: 0,
  ngQty: 0,
  rejectQty: 0,
  okEvents: 0,
  ngEvents: 0,
  rejectEvents: 0,
  downtimeMinutes: 0,
  cycleSamples: 0,
  cycleTotalSeconds: 0,
  bestCycleTimeSeconds: null,
  downtimeByCategory: {},
})

export const mergeRow = (metrics, row) => {
  metrics.logCount += row.logCount
  metrics.okQty += row.okQty
  metrics.ngQty += row.ngQty
  metrics.rejectQty += row.rejectQty
  metrics.okEvents += row.okEvents
  metrics.ngEvents += row.ngEvents
  metrics.rejectEvents += row.rejectEvents
  metrics.downtimeMinutes += row.downtimeMinutes
  metrics.cycleSamples += row.cycleSamples
  metrics.cycleTotalSeconds += row.cycleTotalSeconds

  if (row.bestCycleTimeSeconds !== null && row.bestCycleTimeSeconds !== undefined) {
    metrics.bestCycleTimeSeconds =
      metrics.bestCycleTimeSeconds === null
        ? row.bestCycleTimeSeconds
        : Math.min(metrics.bestCycleTimeSeconds, row.bestCycleTimeSeconds)
  }

  if (row.category) {
    metrics.downtimeByCategory[row.category] =
      (metrics.downtimeByCategory[row.category] ?? 0) + row.downtimeMinutes
  }

  return metrics
}

// Siklus ideal: cycle time tercepat yang pernah tercatat, fallback rata-rata
export const resolveIdealCycleTime = (metrics) => {
  if (metrics.bestCycleTimeSeconds !== null) {
    return { seconds: metrics.bestCycleTimeSeconds, basis: 'MIN_CYCLE_TIME' }
  }
  if (metrics.cycleSamples > 0) {
    return {
      seconds: Math.round(metrics.cycleTotalSeconds / metrics.cycleSamples),
      basis: 'AVG_CYCLE_TIME',
    }
  }
  return { seconds: null, basis: null }
}

const buildOee = ({ plannedMinutes, metrics, idealCycleTimeSeconds, targetQuantity }) => {
  const planned = Math.max(0, Math.round(plannedMinutes))
  const downtime = Math.min(Math.max(metrics.downtimeMinutes, 0), planned)
  const operatingMinutes = Math.max(planned - downtime, 0)
  const totalQty = metrics.okQty + metrics.ngQty + metrics.rejectQty

  const availability = percentage(operatingMinutes, planned)
  const quality = totalQty > 0 ? percentage(metrics.okQty, totalQty) : null

  let performance = null
  let performanceBasis = null
  if (idealCycleTimeSeconds > 0) {
    const idealSeconds = idealCycleTimeSeconds * totalQty
    performance = operatingMinutes > 0 ? round2(Math.min(100, (idealSeconds / (operatingMinutes * 60)) * 100)) : 0
    performanceBasis = 'CYCLE_TIME'
  } else if (targetQuantity > 0) {
    performance = round2(Math.min(100, (totalQty / targetQuantity) * 100))
    performanceBasis = 'TARGET'
  }

  const oee =
    performance === null || quality === null
      ? null
      : round2((availability / 100) * (performance / 100) * (quality / 100) * 100)

  return {
    plannedMinutes: planned,
    downtimeMinutes: downtime,
    operatingMinutes,
    availability,
    performance,
    performanceBasis,
    quality,
    oee,
  }
}

export const finalizeMetrics = ({ metrics, plannedMinutes, targetQuantity = 0 }) => {
  const totalQty = metrics.okQty + metrics.ngQty + metrics.rejectQty
  const { seconds: idealCycleTimeSeconds, basis: idealCycleTimeBasis } = resolveIdealCycleTime(metrics)

  return {
    logCount: metrics.logCount,
    okQty: metrics.okQty,
    ngQty: metrics.ngQty,
    rejectQty: metrics.rejectQty,
    totalQty,
    resultCounts: {
      OK: metrics.okEvents,
      NG: metrics.ngEvents,
      REJECT: metrics.rejectEvents,
    },
    downtimeMinutes: metrics.downtimeMinutes,
    downtimeByCategory: metrics.downtimeByCategory,
    idealCycleTimeSeconds,
    idealCycleTimeBasis,
    oee: buildOee({ plannedMinutes, metrics, idealCycleTimeSeconds, targetQuantity }),
  }
}

// Daftar tanggal kalender pada rentang [from, toExclusive), dipakai untuk zero-fill
export const zonedDays = (from, toExclusive, timeZone) => {
  const dates = []
  let cursor = startOfZonedDay(from, timeZone)

  while (cursor < toExclusive) {
    const p = zonedParts(cursor, timeZone)
    dates.push(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`)
    cursor = zonedTimeToDate(p.year, p.month, p.day + 1, 0, 0, timeZone)
  }

  return dates
}

export const buildFilterSql = ({
  from,
  toExclusive,
  shiftId,
  machineId,
  itemId,
  workOrderId,
  logAlias = 'pl',
  workOrderAlias = 'w',
}) => {
  const conditions = [
    Prisma.sql`${Prisma.raw(logAlias)}."loggedAt" >= ${from}::timestamptz`,
    Prisma.sql`${Prisma.raw(logAlias)}."loggedAt" < ${toExclusive}::timestamptz`,
  ]

  if (workOrderId) conditions.push(Prisma.sql`${Prisma.raw(logAlias)}."workOrderId" = ${workOrderId}`)
  if (shiftId) conditions.push(Prisma.sql`${Prisma.raw(workOrderAlias)}."shiftId" = ${shiftId}`)
  if (machineId) conditions.push(Prisma.sql`${Prisma.raw(workOrderAlias)}."machineId" = ${machineId}`)
  if (itemId) conditions.push(Prisma.sql`${Prisma.raw(workOrderAlias)}."itemId" = ${itemId}`)

  return Prisma.join(conditions, ' AND ')
}

const bucketSql = (whereSql, timeZone) => Prisma.sql`
  SELECT
    (pl."loggedAt" AT TIME ZONE ${timeZone}::text)::date::text AS "day",
    s.id AS "shiftId",
    s.code AS "shiftCode",
    s.name AS "shiftName",
    s."startTime" AS "shiftStart",
    s."endTime" AS "shiftEnd",
    pl."downtimeCategory"::text AS "category",
    COUNT(*)::int AS "logCount",
    COUNT(*) FILTER (WHERE pl."result" = 'OK')::int AS "okEvents",
    COUNT(*) FILTER (WHERE pl."result" = 'NG')::int AS "ngEvents",
    COUNT(*) FILTER (WHERE pl."result" = 'REJECT')::int AS "rejectEvents",
    COALESCE(SUM(pl."goodQty"), 0)::int AS "okQty",
    COALESCE(SUM(pl."ngQty"), 0)::int AS "ngQty",
    COUNT(*) FILTER (WHERE pl."result" = 'REJECT')::int AS "rejectQty",
    COALESCE(SUM(COALESCE(pl."downtimeMinutes", 0)), 0)::int AS "downtimeMinutes",
    MIN(pl."cycleTimeSeconds")::int AS "bestCycleTimeSeconds",
    COUNT(pl."cycleTimeSeconds")::int AS "cycleSamples",
    COALESCE(SUM(COALESCE(pl."cycleTimeSeconds", 0)), 0)::int AS "cycleTotalSeconds"
  FROM production_logs pl
  JOIN work_orders w ON w.id = pl."workOrderId"
  JOIN shifts s ON s.id = w."shiftId"
  WHERE ${whereSql}
  GROUP BY 1, 2, 3, 4, 5, 6, 7
  ORDER BY 1, 2, 7
`

// Catatan defect ditulis ingest dengan format: "Defect: <nama> (<kode>)"
const DEFECT_NOTE_PATTERN = 'Defect:[[:space:]]*([^;(]+)[[:space:]]*\\(([^)]+)\\)'

const paretoSql = (whereSql, timeZone) => Prisma.sql`
  SELECT
    (pl."loggedAt" AT TIME ZONE ${timeZone}::text)::date::text AS "day",
    s.id AS "shiftId",
    BTRIM(m[2]) AS "defectCode",
    NULLIF(BTRIM(m[1]), '') AS "defectNameRaw",
    d.id AS "defectId",
    d.name AS "defectName",
    i.code AS "itemCode",
    i.name AS "itemName",
    COUNT(*)::int AS "events",
    COALESCE(SUM(COALESCE(pl."ngQty", 1)), 0)::int AS "qty"
  FROM production_logs pl
  JOIN work_orders w ON w.id = pl."workOrderId"
  JOIN shifts s ON s.id = w."shiftId"
  LEFT JOIN items i ON i.id = w."itemId"
  CROSS JOIN LATERAL regexp_match(pl."note", ${DEFECT_NOTE_PATTERN}) AS m
  LEFT JOIN defects d ON d.code = BTRIM(m[2])
  WHERE ${whereSql} AND pl."note" LIKE '%Defect:%'
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  ORDER BY 10 DESC
`

// Query Pareto menghasilkan satu baris per (hari, shift, defect),
// jadi baris dengan kode defect yang sama digabung sebelum dihitung persentasenya.
const mergeDefectRows = (rows) => {
  const merged = new Map()

  for (const row of rows) {
    const key = `${row.itemCode ?? '-'}::${row.defectCode}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...row })
      continue
    }
    existing.events += row.events
    existing.qty += row.qty
    existing.defectId = existing.defectId ?? row.defectId
    existing.defectName = existing.defectName ?? row.defectName
    existing.defectNameRaw = existing.defectNameRaw ?? row.defectNameRaw
    existing.itemName = existing.itemName ?? row.itemName
  }

  return [...merged.values()].sort((a, b) => b.qty - a.qty || a.defectCode.localeCompare(b.defectCode))
}

const buildPareto = (rows) => {
  const merged = mergeDefectRows(rows)
  const totalQty = merged.reduce((sum, row) => sum + row.qty, 0)
  let cumulativeQty = 0

  const list = merged.map((row) => {
    const isVitalFew = cumulativeQty < VITAL_FEW_THRESHOLD
    cumulativeQty += row.qty
    const cumulativePercentage = percentage(cumulativeQty, totalQty)
    return {
      defectId: row.defectId,
      defectCode: row.defectCode,
      defectName: row.defectName ?? row.defectNameRaw ?? row.defectCode,
      itemCode: row.itemCode,
      itemName: row.itemName,
      events: row.events,
      qty: row.qty,
      percentage: percentage(row.qty, totalQty),
      cumulativePercentage,
      isVitalFew,
    }
  })

  return { totalQty, list }
}

export const getAnalyticsSummary = async ({
  from,
  toExclusive,
  timeZone = ANALYTICS_TIMEZONE,
  shiftId = null,
  machineId = null,
  itemId = null,
  workOrderId = null,
}) => {
  if (!isValidTimeZone(timeZone)) {
    const error = new Error(`Timezone tidak valid: ${timeZone}`)
    error.status = 400
    throw error
  }

  const days = zonedDays(from, toExclusive, timeZone)
  const rangeDays = days.length
  if (rangeDays > MAX_RANGE_DAYS) {
    const error = new Error(
      `Rentang tanggal terlalu lebar (${rangeDays} hari). Maksimal ${MAX_RANGE_DAYS} hari per permintaan.`,
    )
    error.status = 400
    throw error
  }

  const allShifts = await prisma.shift.findMany({
    select: { id: true, code: true, name: true, startTime: true, endTime: true },
  })
  const scopedShifts = shiftId ? allShifts.filter((shift) => shift.id === shiftId) : allShifts

  if (shiftId && scopedShifts.length === 0) {
    const error = new Error(`Shift tidak ditemukan: ${shiftId}`)
    error.status = 404
    throw error
  }

  // Waktu rencana per hari = total durasi shift yang berada di dalam cakupan filter
  const dailyPlannedMinutes = scopedShifts.reduce((sum, shift) => {
    const duration = shiftDurationMinutes(shift.startTime, shift.endTime)
    return sum + (duration ?? 0)
  }, 0)
  const dailyPlanned = dailyPlannedMinutes > 0 ? dailyPlannedMinutes : 24 * 60

  const where = {
    loggedAt: { gte: from, lt: toExclusive },
    ...(workOrderId ? { workOrderId } : {}),
    ...(shiftId || machineId || itemId
      ? {
          workOrder: {
            is: {
              ...(shiftId ? { shiftId } : {}),
              ...(machineId ? { machineId } : {}),
              ...(itemId ? { itemId } : {}),
            },
          },
        }
      : {}),
  }

  const whereSql = buildFilterSql({ from, toExclusive, shiftId, machineId, itemId, workOrderId })

  const [aggregate, resultGroups, downtimeGroups, scopeWorkOrders, bucketRows, paretoRows] = await Promise.all([
    prisma.productionLog.aggregate({
      where,
      _sum: { goodQty: true, ngQty: true, downtimeMinutes: true },
      _min: { cycleTimeSeconds: true },
    }),
    prisma.productionLog.groupBy({ by: ['result'], where, _count: { _all: true } }),
    prisma.productionLog.groupBy({
      by: ['downtimeCategory'],
      where,
      _count: { _all: true },
      _sum: { downtimeMinutes: true },
    }),
    prisma.productionLog.findMany({
      where,
      distinct: ['workOrderId'],
      select: { workOrder: { select: { targetQuantity: true } } },
    }),
    prisma.$queryRaw(bucketSql(whereSql, timeZone)),
    prisma.$queryRaw(paretoSql(whereSql, timeZone)),
  ])

  const targetQuantity = scopeWorkOrders.reduce(
    (sum, row) => sum + (row.workOrder.targetQuantity ?? 0),
    0,
  )

  const resultCounts = { OK: 0, NG: 0, REJECT: 0 }
  for (const group of resultGroups) {
    resultCounts[group.result] = group._count._all
  }

  const downtimeMinutesOverall = aggregate._sum.downtimeMinutes ?? 0
  const downtimeByCategory = downtimeGroups
    .filter((group) => group.downtimeCategory)
    .map((group) => ({
      category: group.downtimeCategory,
      events: group._count._all,
      minutes: group._sum.downtimeMinutes ?? 0,
      percentage: percentage(group._sum.downtimeMinutes ?? 0, downtimeMinutesOverall),
    }))
    .sort((a, b) => b.minutes - a.minutes)

  // Bucket harian & shift (zero-fill supaya hari tanpa produksi tetap terlihat)
  const dayMetrics = new Map()
  for (const date of days) {
    dayMetrics.set(date, emptyMetrics())
  }

  const shiftMetrics = new Map()
  for (const shift of scopedShifts) {
    const duration = shiftDurationMinutes(shift.startTime, shift.endTime) ?? 0
    shiftMetrics.set(shift.id, {
      shiftId: shift.id,
      shiftCode: shift.code,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      plannedMinutes: duration * rangeDays,
      metrics: emptyMetrics(),
    })
  }

  const overallMetrics = emptyMetrics()
  const paretoByDay = new Map()
  const paretoByShift = new Map()
  const paretoOverall = []

  for (const row of bucketRows) {
    mergeRow(overallMetrics, row)

    const day = dayMetrics.get(row.day)
    if (day) mergeRow(day, row)

    const shift = shiftMetrics.get(row.shiftId)
    if (shift) mergeRow(shift.metrics, row)
  }

  for (const row of paretoRows) {
    paretoOverall.push(row)

    if (dayMetrics.has(row.day)) {
      if (!paretoByDay.has(row.day)) paretoByDay.set(row.day, [])
      paretoByDay.get(row.day).push(row)
    }

    if (shiftMetrics.has(row.shiftId)) {
      if (!paretoByShift.has(row.shiftId)) paretoByShift.set(row.shiftId, [])
      paretoByShift.get(row.shiftId).push(row)
    }
  }

  const byDay = [...dayMetrics.entries()].map(([date, metrics]) => ({
    date,
    ...finalizeMetrics({ metrics, plannedMinutes: dailyPlanned, targetQuantity }),
    defectPareto: buildPareto(paretoByDay.get(date) ?? []).list.slice(0, BUCKET_PARETO_LIMIT),
  }))

  const byShift = [...shiftMetrics.values()].map((shift) => ({
    shiftId: shift.shiftId,
    shiftCode: shift.shiftCode,
    shiftName: shift.shiftName,
    startTime: shift.startTime,
    endTime: shift.endTime,
    days: rangeDays,
    ...finalizeMetrics({
      metrics: shift.metrics,
      plannedMinutes: shift.plannedMinutes,
      targetQuantity,
    }),
    defectPareto: buildPareto(paretoByShift.get(shift.shiftId) ?? []).list.slice(0, BUCKET_PARETO_LIMIT),
  }))

  byShift.sort((a, b) => a.startTime.localeCompare(b.startTime))

  const idealCycleTimeSeconds = resolveIdealCycleTime(overallMetrics).seconds
  const goodQtyOverall = aggregate._sum.goodQty ?? 0
  const ngQtyOverall = aggregate._sum.ngQty ?? 0
  const totals = {
    ...finalizeMetrics({
      metrics: overallMetrics,
      plannedMinutes: dailyPlanned * rangeDays,
      targetQuantity,
    }),
    resultCounts,
    minCycleTimeSeconds: aggregate._min.cycleTimeSeconds,
    targetQuantity,
    achievementPercentage: percentage(goodQtyOverall + ngQtyOverall, targetQuantity),
  }

  return {
    range: {
      from: from.toISOString(),
      to: toExclusive.toISOString(),
      timezone: timeZone,
      days: rangeDays,
    },
    filters: { shiftId, machineId, itemId, workOrderId },
    plannedDailyMinutes: dailyPlanned,
    idealCycleTimeSeconds,
    totals,
    byDay,
    byShift,
    defectPareto: buildPareto(paretoOverall),
    downtimeByCategory,
  }
}
