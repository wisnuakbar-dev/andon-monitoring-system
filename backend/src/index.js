import http from 'http'
import { PORT, NODE_ENV } from './config/index.js'
import app from './app.js'
import { startIngest, stopIngest } from './services/ingest.js'
import { initSocket, closeSocket } from './services/socket.service.js'
import { attachKpiRealtime, stopKpiBroadcaster } from './services/kpi.broadcaster.js'

const server = http.createServer(app)

initSocket(server)
attachKpiRealtime()

server.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Andon API berjalan di http://localhost:${PORT}`)
  startIngest()
})

const shutdown = () => {
  console.log('\n[server] Menutup layanan...')
  stopKpiBroadcaster()
  stopIngest()
  // io.close() sekaligus menutup HTTP server yang di-mount
  closeSocket().finally(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)