import { isValidTimeZone, zonedParts, zonedTimeToDate } from './zonedTime.js'

export const DEFAULT_RANGE_DAYS = 7

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export const parseDateParam = (value, timeZone, { endOfDay = false } = {}) => {
  if (!DATE_ONLY.test(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const [year, month, day] = value.split('-').map(Number)
  if (endOfDay) {
    return new Date(zonedTimeToDate(year, month, day + 1, 0, 0, timeZone).getTime() - 1)
  }
  return zonedTimeToDate(year, month, day, 0, 0, timeZone)
}

export const resolveTimeZone = (raw, fallback) => {
  const timeZone = String(raw || fallback)
  if (!isValidTimeZone(timeZone)) {
    return { timeZone, error: `timezone tidak valid: ${timeZone}` }
  }
  return { timeZone, error: null }
}

export const resolveIdFilters = (query, keys) => {
  const ids = {}
  for (const key of keys) {
    ids[key] = query[key] === undefined ? null : Number(query[key])
    if (query[key] !== undefined && (!Number.isInteger(ids[key]) || ids[key] <= 0)) {
      return { ids, error: `${key} tidak valid, harus berupa bilangan bulat positif` }
    }
  }
  return { ids, error: null }
}

// Rentang [from, toExclusive) - "to" bersifat inklusif, "date" memakai satu hari penuh
export const resolveRange = ({ from, to, date, timeZone, defaultDays = DEFAULT_RANGE_DAYS }) => {
  if (date !== undefined && date !== '') {
    const start = parseDateParam(String(date), timeZone)
    if (!start) return { error: 'date tidak valid, gunakan format YYYY-MM-DD' }
    const p = zonedParts(start, timeZone)
    return { from: start, toExclusive: zonedTimeToDate(p.year, p.month, p.day + 1, 0, 0, timeZone) }
  }

  const now = new Date()
  let start
  if (from) {
    start = parseDateParam(String(from), timeZone)
    if (!start) return { error: 'from tidak valid, gunakan format YYYY-MM-DD atau ISO-8601' }
  } else {
    const p = zonedParts(now, timeZone)
    start = zonedTimeToDate(p.year, p.month, p.day - (defaultDays - 1), 0, 0, timeZone)
  }

  let end
  if (to) {
    end = parseDateParam(String(to), timeZone, { endOfDay: true })
    if (!end) return { error: 'to tidak valid, gunakan format YYYY-MM-DD atau ISO-8601' }
  } else {
    end = now
  }

  if (start > end) return { error: 'from tidak boleh lebih besar dari to' }

  return { from: start, toExclusive: new Date(end.getTime() + 1) }
}
