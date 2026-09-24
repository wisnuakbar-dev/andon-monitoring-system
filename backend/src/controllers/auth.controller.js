import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/index.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'username dan password wajib diisi' })
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  })

  if (!user) {
    return res.status(401).json({ message: 'Kredensial tidak valid' })
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    return res.status(401).json({ message: 'Kredensial tidak valid' })
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role.code },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  const { password: _omit, ...safeUser } = user

  res.json({ token, tokenType: 'Bearer', user: safeUser })
})

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  })

  if (!user) {
    return res.status(404).json({ message: 'User tidak ditemukan' })
  }

  const { password: _omit, ...safeUser } = user
  res.json(safeUser)
})