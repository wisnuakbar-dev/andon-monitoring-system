import dotenv from 'dotenv'

dotenv.config()

export const PORT = process.env.PORT || 3000
export const NODE_ENV = process.env.NODE_ENV || 'development'
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-ganti-di-produksi'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

export const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'wss://test.mosquitto.org:8081/mqtt'
export const MQTT_TOPIC = process.env.MQTT_TOPIC || 'andon/simulator'
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
