import { ANALYTICS_TIMEZONE } from '../config/index.js'
import { getAnalyticsSummary } from '../services/analytics.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { resolveIdFilters, resolveRange, resolveTimeZone } from '../utils/dateRange.js'

const ID_KEYS = ['shiftId', 'machineId', 'itemId', 'workOrderId']

export const getAnalyticsSummaryHandler = asyncHandler(async (req, res) => {
  const { timeZone, error: tzError } = resolveTimeZone(req.query.timezone, ANALYTICS_TIMEZONE)
  if (tzError) return res.status(400).json({ message: tzError })

  const { error: rangeError, ...range } = resolveRange({
    from: req.query.from,
    to: req.query.to,
    timeZone,
  })
  if (rangeError) return res.status(400).json({ message: rangeError })

  const { ids, error: idError } = resolveIdFilters(req.query, ID_KEYS)
  if (idError) return res.status(400).json({ message: idError })

  const summary = await getAnalyticsSummary({
    from: range.from,
    toExclusive: range.toExclusive,
    timeZone,
    shiftId: ids.shiftId,
    machineId: ids.machineId,
    itemId: ids.itemId,
    workOrderId: ids.workOrderId,
  })

  res.json(summary)
})
