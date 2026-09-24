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