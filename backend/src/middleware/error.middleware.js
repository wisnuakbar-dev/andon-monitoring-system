export const notFound = (req, res) => {
  res.status(404).json({ message: `Route tidak ditemukan: ${req.originalUrl}` })
}

export const errorHandler = (err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
}