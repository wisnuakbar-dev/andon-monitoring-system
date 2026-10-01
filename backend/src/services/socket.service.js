import { Server } from 'socket.io'
import { CLIENT_URL, SOCKET_PATH, SOCKET_PING_INTERVAL, SOCKET_PING_TIMEOUT } from '../config/index.js'
import { resolveUserFromToken } from '../utils/authToken.js'

export const SCOPE_ROOM_PREFIX = 'kpi:'
export const roomForScope = (scopeKey) => `${SCOPE_ROOM_PREFIX}${scopeKey}`

let io = null

// scopeKey -> Set<socketId>, dipakai untuk tahu scope mana yang masih punya pendengar
const scopeMembers = new Map()

const registerMember = (scopeKey, socketId) => {
  const members = scopeMembers.get(scopeKey) ?? new Set()
  members.add(socketId)
  scopeMembers.set(scopeKey, members)
}

const removeMember = (scopeKey, socketId) => {
  const members = scopeMembers.get(scopeKey)
  if (!members) return
  members.delete(socketId)
  if (members.size === 0) scopeMembers.delete(scopeKey)
}

const removeSocketFromAllScopes = (socketId) => {
  for (const scopeKey of [...scopeMembers.keys()]) removeMember(scopeKey, socketId)
}

const readToken = (socket) => {
  const auth = socket.handshake.auth ?? {}
  const raw = auth.token ?? socket.handshake.query?.token
  if (Array.isArray(raw)) return ''
  return raw ? String(raw).replace(/^Bearer\s+/i, '') : ''
}

/**
 * Pasang Socket.IO ke HTTP server Express.
 * Handshake wajib memakai JWT yang valid; data user disimpan di socket.data
 * supaya handler berikutnya (mis. broadcast KPI) tahu siapa pendengarnya.
 */
export const initSocket = (httpServer) => {
  if (io) return io

  io = new Server(httpServer, {
    path: SOCKET_PATH,
    cors: { origin: CLIENT_URL, credentials: true },
    pingInterval: SOCKET_PING_INTERVAL,
    pingTimeout: SOCKET_PING_TIMEOUT,
  })

  io.use(async (socket, next) => {
    try {
      const { user, error } = await resolveUserFromToken(readToken(socket))
      if (error) return next(new Error(error))
      socket.data.user = { id: user.id, username: user.username, roleCode: user.role.code }
      next()
    } catch (err) {
      next(new Error('Autentikasi gagal'))
    }
  })

  io.on('connection', (socket) => {
    const { username, roleCode } = socket.data.user
    console.log(`[socket] Klien terhubung: ${socket.id} (${username}/${roleCode})`)

    socket.on('disconnect', (reason) => {
      removeSocketFromAllScopes(socket.id)
      console.log(`[socket] Klien terputus: ${socket.id} (${reason})`)
    })
  })

  console.log(`[socket] Socket.IO siap di path "${SOCKET_PATH}" (CORS: ${CLIENT_URL})`)

  return io
}

export const getIo = () => io

export const joinScope = (socket, scopeKey) => {
  registerMember(scopeKey, socket.id)
  socket.join(roomForScope(scopeKey))
}

export const leaveScope = (socket, scopeKey) => {
  removeMember(scopeKey, socket.id)
  socket.leave(roomForScope(scopeKey))
}

export const leaveAllScopes = (socket) => {
  for (const scopeKey of socket.data.scopeKeys ?? []) leaveScope(socket, scopeKey)
  socket.data.scopeKeys = []
  removeSocketFromAllScopes(socket.id)
}

export const setSocketScopes = (socket, scopeKeys) => {
  for (const scopeKey of socket.data.scopeKeys ?? []) {
    if (!scopeKeys.includes(scopeKey)) leaveScope(socket, scopeKey)
  }
  for (const scopeKey of scopeKeys) {
    if (!(socket.data.scopeKeys ?? []).includes(scopeKey)) joinScope(socket, scopeKey)
  }
  socket.data.scopeKeys = scopeKeys
}

export const activeScopes = () => [...scopeMembers.keys()]
export const subscriberCount = (scopeKey) => scopeMembers.get(scopeKey)?.size ?? 0

export const emitToScope = (scopeKey, event, payload) => {
  if (!io) return 0
  return io.to(roomForScope(scopeKey)).emit(event, payload)
}

export const emitToSocket = (socket, event, payload) => {
  if (!socket?.connected) return
  socket.emit(event, payload)
}

export const getSocketStats = () => ({
  path: SOCKET_PATH,
  clients: io?.engine?.clientsCount ?? 0,
  scopes: activeScopes().map((scopeKey) => ({ scopeKey, subscribers: subscriberCount(scopeKey) })),
})

export const closeSocket = () =>
  new Promise((resolve) => {
    if (!io) return resolve()
    const server = io
    io = null
    scopeMembers.clear()
    server.close(() => resolve())
  })