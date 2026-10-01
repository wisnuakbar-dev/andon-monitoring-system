import { Prisma } from '@prisma/client'
import prisma from '../config/prisma.js'
import { ANALYTICS_TIMEZONE, KPI_RANGE_DAYS, KPI_RECENT_LOGS } from '../config/index.js'
import {
  buildFilterSql,
  emptyMetrics,
  finalizeMetrics,
  mergeRow,
  percentage,
  resolveIdealCycleTime,
  shiftDurationMinutes,
  zonedDays,
} from './analytics.service.js'
import { resolveIdFilters, resolveRange, resolveTimeZone } from '../utils/dateRange.js'
import { isValidTimeZone } from '../utils/zonedTime.js'

const TOP_DEFECT_LIMIT = 5

export const KPI_ID_KEYS = ['shiftId', 'machineId', 'itemId', 'workOrderId']
export const KPI_PARAM_KEYS = ['timezone', 'rangeDays', 'from', 'to', ...KPI_ID_KEYS]

/** Ambil hanya parameter yang dikenal supaya payload klien tidak ikut tersimpan. */
export const sanitizeScopeParams = (params = {}) => {
  const sanitized = {}
  for (const key of KPI_PARAM_KEYS) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') sanitized[key] = params[key]
  }
  return sanitized
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

// Bucket per (mesin, shift, kategori downtime) supaya byMachine dan byShift bisa
// digabung dari satu query. Target quantity ikut diambil lewat CROSS JOIN agar
// seluruh angka KPI cukup satu round trip ke database.
const metricsSql = ({ whereSql, targetWhereSql }) => Prisma.sql`
  SELECT
    buckets.*,
    targets."targetQuantity"
  FROM (
    SELECT
      w."machineId" AS "machineId",
      m.code AS "machineCode",
      m.name AS "machineName",
      m."isActive" AS "machineActive",
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
    JOIN machines m ON m.id = w."machineId"
    WHERE ${whereSql}
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    ORDER BY 1, 5, 10
  ) buckets
  CROSS JOIN (
    SELECT COALESCE(SUM(scope_wo."targetQuantity"), 0)::int AS "targetQuantity"
    FROM (
      SELECT DISTINCT w2.id, w2."targetQuantity"
      FROM production_logs pl2
      JOIN work_orders w2 ON w2.id = pl2."workOrderId"
      WHERE ${targetWhereSql}
    ) scope_wo
  ) targets
`

const topDefectSql = (whereSql) => Prisma.sql`
  SELECT
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
  LEFT JOIN items i ON i.id = w."itemId"
  CROSS JOIN LATERAL regexp_match(pl."note", ${'Defect:[[:space:]]*([^;(]+)[[:space:]]*\\(([^)]+)\\)'}) AS m
  LEFT JOIN defects d ON d.code = BTRIM(m[2])
  WHERE ${whereSql} AND pl."note" LIKE '%Defect:%'
  GROUP BY 1, 2, 3, 4, 5, 6
  ORDER BY 7 DESC, 1
  LIMIT ${TOP_DEFECT_LIMIT}
`

// Deret per jam (waktu lokal laporan) untuk grafik planning/DCS pada layar andon
const hourlySql = ({ whereSql, timeZone }) => Prisma.sql`
  SELECT
    to_char(date_trunc('hour', pl."loggedAt" AT TIME ZONE ${timeZone}::text), 'YYYY-MM-DD HH24:MI') AS "hour",
    COUNT(*)::int AS "logCount",
    COALESCE(SUM(pl."goodQty"), 0)::int AS "okQty",
    COALESCE(SUM(pl."ngQty"), 0)::int AS "ngQty",
    COUNT(*) FILTER (WHERE pl."result" = 'REJECT')::int AS "rejectQty",
    COALESCE(SUM(COALESCE(pl."downtimeMinutes", 0)), 0)::int AS "downtimeMinutes"
  FROM production_logs pl
  JOIN work_orders w ON w.id = pl."workOrderId"
  WHERE ${whereSql}
  GROUP BY 1
  ORDER BY 1
`

// Semua mesin + event terakhirnya, supaya papan andon tetap menampilkan mesin
// yang belum punya log (dan tidak perlu endpoint masterdata dengan RBAC Supervisor)
const machineStatusSql = ({ whereSql, machineId }) => Prisma.sql`
  SELECT
    m.id AS "machineId",
    m.code AS "machineCode",
    m.name AS "machineName",
    m."isActive" AS "isActive",
    m.location AS "machineLocation",
    latest."logId",
    latest."result",
    latest."downtimeCategory",
    latest."downtimeMinutes",
    latest."loggedAt",
    latest."note"
  FROM machines m
  ${machineId ? Prisma.sql`WHERE m.id = ${machineId}` : Prisma.empty}
  LEFT JOIN LATERAL (
    SELECT
      pl.id AS "logId",
      pl."result"::text AS "result",
      pl."downtimeCategory"::text AS "downtimeCategory",
      pl."downtimeMinutes",
      pl."note",
      pl."loggedAt"
    FROM production_logs pl
    JOIN work_orders w ON w.id = pl."workOrderId"
    WHERE w."machineId" = m.id AND ${whereSql}
    ORDER BY pl."loggedAt" DESC, pl.id DESC
    LIMIT 1
  ) latest ON true
  ORDER BY m.code
`

const buildTopDefects = (rows) => {
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  let cumulativeQty = 0

  return rows.map((row) => {
    const isVitalFew = cumulativeQty < 80
    cumulativeQty += row.qty
    return {
      defectId: row.defectId,
      defectCode: row.defectCode,
      defectName: row.defectName ?? row.defectNameRaw ?? row.defectCode,
      itemCode: row.itemCode,
      itemName: row.itemName,
      events: row.events,
      qty: row.qty,
      percentage: percentage(row.qty, totalQty),
      cumulativePercentage: percentage(cumulativeQty, totalQty),
      isVitalFew,
    }
  })
}

const prismaWhere = ({ from, toExclusive, shiftId, machineId, itemId, workOrderId }) => ({
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
})

/**
 * Satu payload KPI untuk seluruh klien WebSocket: total produksi, komponen OEE,
 * downtime per kategori, Pareto defect, KPI per mesin & per shift, dan log terbaru.
 */
export const getKpiSnapshot = async ({
  from,
  toExclusive,
  timeZone = ANALYTICS_TIMEZONE,
  shiftId = null,
  machineId = null,
  itemId = null,
  workOrderId = null,
  recentLogs = KPI_RECENT_LOGS,
}) => {
  if (!isValidTimeZone(timeZone)) {
    const error = new Error(`Timezone tidak valid: ${timeZone}`)
    error.status = 400
    throw error
  }

  const filters = { shiftId, machineId, itemId, workOrderId }
  const where = prismaWhere({ from, toExclusive, ...filters })
  const whereSql = buildFilterSql({ from, toExclusive, ...filters })
  const targetWhereSql = buildFilterSql({
    from,
    toExclusive,
    ...filters,
    logAlias: 'pl2',
    workOrderAlias: 'w2',
  })

  const [allShifts, metricRows, topDefectRows, hourRows, machineRows, logs] = await Promise.all([
    prisma.shift.findMany({
      select: { id: true, code: true, name: true, startTime: true, endTime: true },
    }),
    prisma.$queryRaw(metricsSql({ whereSql, targetWhereSql })),
    prisma.$queryRaw(topDefectSql(whereSql)),
    prisma.$queryRaw(hourlySql({ whereSql, timeZone })),
    prisma.$queryRaw(machineStatusSql({ whereSql, machineId })),
    prisma.productionLog.findMany({
      where,
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: recentLogs,
      include: {
        workOrder: {
          select: {
            id: true,
            code: true,
            machine: { select: { id: true, code: true, name: true } },
            item: { select: { id: true, code: true, name: true } },
            shift: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
  ])

  const rangeDays = Math.max(1, zonedDays(from, toExclusive, timeZone).length)
  const targetQuantity = metricRows[0]?.targetQuantity ?? 0

  const scopedShifts = shiftId ? allShifts.filter((shift) => shift.id === shiftId) : allShifts
  const dailyPlannedMinutes = scopedShifts.reduce(
    (sum, shift) => sum + (shiftDurationMinutes(shift.startTime, shift.endTime) ?? 0),
    0,
  )
  const dailyPlanned = dailyPlannedMinutes > 0 ? dailyPlannedMinutes : 24 * 60

  const overallMetrics = emptyMetrics()
  const machineRollup = new Map()
  const shiftRollup = new Map()

  for (const row of metricRows) {
    mergeRow(overallMetrics, row)

    const machine = machineRollup.get(row.machineId) ?? {
      machineId: row.machineId,
      machineCode: row.machineCode,
      machineName: row.machineName,
      isActive: row.machineActive,
      plannedShiftMinutes: 0,
      metrics: emptyMetrics(),
    }
    mergeRow(machine.metrics, row)
    machine.plannedShiftMinutes += shiftDurationMinutes(row.shiftStart, row.shiftEnd) ?? 0
    machineRollup.set(row.machineId, machine)

    const shift = shiftRollup.get(row.shiftId) ?? {
      shiftId: row.shiftId,
      shiftCode: row.shiftCode,
      shiftName: row.shiftName,
      startTime: row.shiftStart,
      endTime: row.shiftEnd,
      plannedMinutes: (shiftDurationMinutes(row.shiftStart, row.shiftEnd) ?? 0) * rangeDays,
      metrics: emptyMetrics(),
    }
    mergeRow(shift.metrics, row)
    shiftRollup.set(row.shiftId, shift)
  }

  const resultCounts = { OK: 0, NG: 0, REJECT: 0 }
  for (const row of metricRows) {
    resultCounts.OK += row.okEvents ?? 0
    resultCounts.NG += row.ngEvents ?? 0
    resultCounts.REJECT += row.rejectEvents ?? 0
  }

  // Kategori downtime & cycle time tercepat ikut diturunkan dari bucket yang sama
  const downtimeMinutesOverall = overallMetrics.downtimeMinutes
  const downtimeByCategory = Object.entries(overallMetrics.downtimeByCategory)
    .filter(([category]) => category !== 'null' && category !== '')
    .map(([category, minutes]) => ({
      category,
      events: metricRows
        .filter((row) => row.category === category)
        .reduce((sum, row) => sum + row.logCount, 0),
      minutes,
      percentage: percentage(minutes, downtimeMinutesOverall),
    }))
    .sort((a, b) => b.minutes - a.minutes)

  const goodQtyOverall = overallMetrics.okQty
  const ngQtyOverall = overallMetrics.ngQty

  const totals = {
    ...finalizeMetrics({
      metrics: overallMetrics,
      plannedMinutes: dailyPlanned * rangeDays,
      targetQuantity,
    }),
    resultCounts,
    minCycleTimeSeconds: resolveIdealCycleTime(overallMetrics).seconds,
    targetQuantity,
    achievementPercentage: percentage(goodQtyOverall + ngQtyOverall, targetQuantity),
  }

  const byMachine = [...machineRollup.values()]
    .map((machine) => ({
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      isActive: machine.isActive,
      ...finalizeMetrics({
        metrics: machine.metrics,
        plannedMinutes: machine.plannedShiftMinutes * rangeDays,
        targetQuantity,
      }),
    }))
    .sort((a, b) => b.totalQty - a.totalQty || a.machineCode.localeCompare(b.machineCode))

  const byShift = [...shiftRollup.values()]
    .map((shift) => ({
      shiftId: shift.shiftId,
      shiftCode: shift.shiftCode,
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      ...finalizeMetrics({ metrics: shift.metrics, plannedMinutes: shift.plannedMinutes, targetQuantity }),
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Deret jam untuk grafik planning: output & downtime tiap jam dalam zona laporan
const byHour = hourRows.map((row) => ({
    hour: row.hour,
    logCount: row.logCount,
    okQty: row.okQty,
    ngQty: row.ngQty,
    rejectQty: row.rejectQty,
    totalQty: row.okQty + row.ngQty + row.rejectQty,
    downtimeMinutes: row.downtimeMinutes,
  }))

  // Status terakhir tiap mesin; digabung dengan agregat KPI per mesin
  const metricsByMachineId = new Map(byMachine.map((machine) => [machine.machineId, machine]))
  const machineStatus = machineRows.map((row) => {
    const metrics = metricsByMachineId.get(row.machineId) ?? null
    return {
      machineId: row.machineId,
      machineCode: row.machineCode,
      machineName: row.machineName,
      isActive: row.isActive,
      location: row.machineLocation,
      lastLogId: row.logId,
      lastResult: row.result,
      lastDowntimeCategory: row.downtimeCategory,
      lastDowntimeMinutes: row.downtimeMinutes,
      lastNote: row.note,
      lastEventAt: row.loggedAt ? new Date(row.loggedAt).toISOString() : null,
      outputQty: metrics?.totalQty ?? 0,
      okQty: metrics?.okQty ?? 0,
      ngQty: metrics?.ngQty ?? 0,
      downtimeMinutes: metrics?.downtimeMinutes ?? 0,
      logCount: metrics?.logCount ?? 0,
      oee: metrics?.oee ?? null,
      quality: metrics?.oee?.quality ?? null,
      availability: metrics?.oee?.availability ?? null,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    range: {
      from: from.toISOString(),
      to: toExclusive.toISOString(),
      timezone: timeZone,
      days: rangeDays,
    },
    filters,
    idealCycleTimeSeconds: totals.idealCycleTimeSeconds,
    totals,
    downtimeByCategory,
    topDefects: buildTopDefects(topDefectRows),
    byMachine,
    byShift,
    byHour,
    machineStatus,
    recentLogs: logs.map(decorate),
  }
}

/**
 * Terjemahkan parameter kiriman klien (socket atau REST) menjadi scope KPI.
 * Scope dipakai sebagai kunci room WebSocket sehingga setiap klien hanya
 * menerima payload yang sesuai dengan filter halaman yang sedang dibuka.
 */
export const resolveKpiScope = (rawParams = {}) => {
  const params = sanitizeScopeParams(rawParams)
  const { timeZone, error: tzError } = resolveTimeZone(params.timezone, ANALYTICS_TIMEZONE)
  if (tzError) return { error: tzError }

  const rawRangeDays = Number(params.rangeDays)
  const rangeDays = Number.isInteger(rawRangeDays) && rawRangeDays > 0 ? Math.min(rawRangeDays, 366) : KPI_RANGE_DAYS

  const { error: rangeError, ...range } = resolveRange({
    from: params.from,
    to: params.to,
    timeZone,
    defaultDays: rangeDays,
  })
  if (rangeError) return { error: rangeError }

  const { ids, error: idError } = resolveIdFilters(params, KPI_ID_KEYS)
  if (idError) return { error: idError }

  const scope = { timeZone, rangeDays, from: range.from, toExclusive: range.toExclusive, ...ids }
  const key = KPI_ID_KEYS.map((field) => `${field}=${scope[field] ?? '-'}`).join('&')
  const keySuffix =
    params.from || params.to ? `&range=${scope.from.toISOString()}/${scope.toExclusive.toISOString()}` : ''

  return { scope, key: `v1|${timeZone}|days=${rangeDays}|${key}${keySuffix}`, error: null }
}