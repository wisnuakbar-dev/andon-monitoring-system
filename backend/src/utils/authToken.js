import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { JWT_SECRET } from '../config/index.js'

// Verifikasi JWT lalu ambil user beserta role-nya.
// Dipakai oleh middleware HTTP dan handshake socket.io agar aturan auth sama.
export const resolveUserFromToken = async (token) => {
  if (!token) return { user: null, error: 'Token tidak ditemukan' }

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return { user: null, error: 'Token tidak valid atau sudah kedaluwarsa' }
  }

  if (!Number.isInteger(payload.sub)) return { user: null, error: 'Token tidak valid atau sudah kedaluwarsa' }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  })

  if (!user) return { user: null, error: 'User tidak terdaftar' }

  return { user, error: null }
}