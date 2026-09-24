import { PORT, NODE_ENV } from './config/index.js'
import app from './app.js'
import { startIngest, stopIngest } from './services/ingest.js'

app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Andon API berjalan di http://localhost:${PORT}`)
  startIngest()
})

const shutdown = () => {
  console.log('\n[server] Menutup layanan...')
  stopIngest()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)