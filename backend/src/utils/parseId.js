export const parseId = (value) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export const notFoundMessage = (entity) => `${entity} tidak ditemukan`