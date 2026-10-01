import { io } from 'socket.io-client'

const login = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})
const token = (await login.json()).token

const client = io('http://localhost:3000', { auth: { token }, transports: ['websocket'] })
const scope = JSON.parse(process.argv[2] ?? '{}')

client.on('connect', () => {
  console.log('connected', client.id)
  client.emit('kpi:subscribe', scope)
})
client.on('kpi:snapshot', ({ snapshot, reason }) => {
  console.log(`snapshot reason=${reason} range=${snapshot.range.from}..${snapshot.range.to} tz=${snapshot.range.timezone}`)
  console.log('  byHour:', snapshot.byHour.map((h) => `${h.hour}=${h.totalQty}`).join(' '))
  console.log('  machineStatus:', snapshot.machineStatus.map((m) => `${m.machineCode}:${m.lastResult ?? 'null'}/${m.outputQty}`).join(' '))
  console.log('  totals ok/ng/reject:', snapshot.totals.okQty, snapshot.totals.ngQty, snapshot.totals.rejectQty, 'oee', snapshot.totals.oee.oee)
  client.close()
  process.exit(0)
})
client.on('connect_error', (e) => { console.log('ERR', e.message); process.exit(1) })
setTimeout(() => { console.log('timeout'); process.exit(1) }, 45000)
