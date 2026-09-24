import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { JWT_SECRET } from '../config/index.js'

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Gunakan header: Authorization: Bearer <token>' })
  }

  let payload
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET)
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' })
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  })

  if (!user) {
    return res.status(401).json({ message: 'User tidak terdaftar' })
  }

  req.user = user
  next()
}

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Autentikasi diperlukan' })
  }
  const roleCode = req.user.role.code
  if (!allowedRoles.includes(roleCode)) {
    return res.status(403).json({
      message: `Akses ditolak. Role '${roleCode}' tidak memiliki izin untuk operasi ini (dibutuhkan: ${allowedRoles.join(', ')})`,
    })
  }
  next()
}

export const readAccess = [authenticate, authorize('ADMIN', 'SUPERVISOR')]
export const writeAccess = [authenticate, authorize('ADMIN')]