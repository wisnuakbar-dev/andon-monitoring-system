import { resolveUserFromToken } from '../utils/authToken.js'

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Gunakan header: Authorization: Bearer <token>' })
  }

  const { user, error } = await resolveUserFromToken(header.slice(7))
  if (error) return res.status(401).json({ message: error })

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