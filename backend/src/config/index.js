import dotenv from 'dotenv'

dotenv.config()

export const PORT = process.env.PORT || 3000
export const NODE_ENV = process.env.NODE_ENV || 'development'
// Satu atau banyak origin frontend yang diizinkan CORS, dipisah koma.
// Contoh produksi: CLIENT_URL="http://localhost:5173,https://andon.vercel.app"
export const CLIENT_ORIGINS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const CLIENT_URL = CLIENT_ORIGINS[0]

export const corsOrigin = (origin, callback) => {
  if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true)
  return callback(null, false)
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-ganti-di-produksi'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

// Daftar broker MQTT, mencoba berurutan sampai ada yang bisa dikoneksikan.
// Broker pertama (MQTT_BROKER_URL) adalah yang dipakai browser lewat WebSocket,
// jadi backend dan frontend selalu.publish ke broker yang sama.
const MQTT_BROKERS = (process.env.MQTT_BROKERS
  || process.env.MQTT_BROKER_URL
  || 'mqtt://test.mosquitto.org:1883,mqtt://broker.hivemq.com:1883')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

export const MQTT_BROKER_URLS = MQTT_BROKERS
export const MQTT_BROKER_URL = MQTT_BROKERS[0]

// Topik yang di-subscribe backend (bisa beberapa topik, dipisah koma).
// Wildcard "andon/#" juga didukung, tapi pada broker publik akan ikut
// menangkap trafik aplikasi lain yang memakai topik serupa.
export const MQTT_TOPICS = (process.env.MQTT_TOPICS || process.env.MQTT_TOPIC || 'andon/simulator')
  .split(',')
  .map((topic) => topic.trim())
  .filter(Boolean)

export const MQTT_TOPIC = MQTT_TOPICS[0]
export const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || 'andon-ingest'

// Zona waktu untuk pengelompokan "per hari" pada laporan analytics
export const ANALYTICS_TIMEZONE = process.env.ANALYTICS_TIMEZONE || 'Asia/Jakarta'

// WebSocket (socket.io) untuk broadcast KPI realtime
export const SOCKET_PATH = process.env.SOCKET_PATH || '/socket.io'
export const SOCKET_PING_INTERVAL = Number(process.env.SOCKET_PING_INTERVAL) || 25000
export const SOCKET_PING_TIMEOUT = Number(process.env.SOCKET_PING_TIMEOUT) || 20000

// Broadcast KPI: jeda (ms) untuk menggabungkan burst pesan MQTT menjadi satu emit
export const KPI_BROADCAST_DEBOUNCE_MS = Number(process.env.KPI_BROADCAST_DEBOUNCE_MS) || 500
// Rentang default (hari) yang dihitung untuk KPI yang di-broadcast
export const KPI_RANGE_DAYS = Number(process.env.KPI_RANGE_DAYS) || 7
// Jumlah log terbaru yang disertakan pada payload KPI
export const KPI_RECENT_LOGS = Number(process.env.KPI_RECENT_LOGS) || 10
