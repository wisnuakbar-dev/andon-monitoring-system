const partsFormatter = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export const zonedParts = (date, timeZone) => {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type) => Number(parts.find((part) => part.type === type)?.value)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl bisa mengembalikan "24" untuk tengah malam
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

const zoneOffsetMs = (date, timeZone) => {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - date.getTime()
}

// Tanggal dinding zona waktu (YYYY-MM-DD HH:mm) -> instante UTC
export const zonedTimeToDate = (year, month, day, hour, minute, timeZone) => {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0)
  const firstPass = wallClock - zoneOffsetMs(new Date(wallClock), timeZone)
  // Di dua kali pengulangan jam (DST) offset dihitung ulang dari hasil awal
  const secondPass = wallClock - zoneOffsetMs(new Date(firstPass), timeZone)
  return new Date(secondPass)
}

export const startOfZonedDay = (date, timeZone) => {
  const p = zonedParts(date, timeZone)
  return zonedTimeToDate(p.year, p.month, p.day, 0, 0, timeZone)
}

export const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}
