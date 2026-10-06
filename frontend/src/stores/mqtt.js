import { defineStore } from 'pinia'
import mqtt from 'mqtt'
import api from '@/services/api'

// Fallback dipakai hanya sampai config dari backend (/realtime/ingest-config)
// berhasil dimuat. Backend adalah sumber kebenaran supaya tidak ada publish
// ke broker yang berbeda dari yang di-subscribe ingest.
const FALLBACK_URL = 'wss://test.mosquitto.org:8081/mqtt'
const FALLBACK_TOPIC = 'andon/simulator'
const MAX_LOG = 50

export const useMqttStore = defineStore('mqtt', {
  state: () => ({
    client: null,
    status: 'disconnected',
    url: FALLBACK_URL,
    topic: FALLBACK_TOPIC,
    error: null,
    log: [],
    configLoaded: false,
    backendBroker: null,
    // Bernilai true kalau user mengetik sendiri, supaya loadBackendConfig tidak
    // menimpa nilai yang sudah diketik manual.
    userEditedUrl: false,
    userEditedTopic: false,
  }),
  getters: {
    isConnected: (state) => state.status === 'connected',
    isBusy: (state) => state.status === 'connecting',
  },
  actions: {
    /**
     * Ambil broker + topik yang sedang di-subscribe backend. Nilai di input
     * hanya dipakai kalau user benar-benar mengeditnya sendiri (manual override).
     */
    async loadBackendConfig() {
      try {
        const { data } = await api.get('/realtime/ingest-config')
        this.backendBroker = data.brokerWsUrl ?? data.broker ?? null
        this.configLoaded = true
        const first = data.topics?.[0] ?? null
        // Kalau backend subscribe wildcard (mis. "andon/#"), pakai subtopik
        // turunannya. Kalau topiknya spesifik, publish ke topik yang sama.
        const derived = first?.endsWith('/#') ? `${first.slice(0, -2)}simulator` : first
        if (derived && !this.userEditedTopic) this.topic = derived
        if (data.brokerWsUrl && !this.userEditedUrl) this.url = data.brokerWsUrl
      } catch (err) {
        this.addLog('Gagal ambil config broker backend', { error: err?.message })
      }
    },

    connect() {
      this.disconnect({ silent: true })
      this.status = 'connecting'
      this.error = null
      try {
        this.client = mqtt.connect(this.url.trim(), {
          clientId: `andon_sim_${Math.random().toString(16).slice(2, 10)}`,
          clean: true,
          connectTimeout: 10000,
          reconnectPeriod: 3000,
          keepalive: 60,
        })

        this.client.on('connect', () => {
          this.status = 'connected'
          this.error = null
          this.addLog('Terhubung ke broker', { url: this.url.trim(), topic: this.topic.trim() })
        })

        this.client.on('error', (err) => {
          this.status = this.isConnected ? this.status : 'error'
          this.error = err?.message || 'Terjadi kesalahan koneksi MQTT'
        })

        this.client.on('reconnect', () => {
          this.status = 'connecting'
        })

        this.client.on('close', () => {
          if (this.status !== 'error') {
            this.status = this.client?.reconnecting ? 'connecting' : 'disconnected'
          }
        })

        this.client.on('offline', () => {
          if (this.status !== 'error') this.status = 'disconnected'
        })
      } catch (err) {
        this.status = 'error'
        this.error = err?.message || 'Gagal membuat koneksi MQTT'
      }
    },

    disconnect({ silent = false } = {}) {
      if (this.client) {
        this.client.end(true)
        this.client = null
      }
      this.status = 'disconnected'
      if (!silent) this.addLog('Terputus dari broker', null)
    },

    publish(event, payload) {
      if (!this.isConnected || !this.client) {
        throw new Error('Belum terhubung ke broker MQTT')
      }
      const message = JSON.stringify({ event, ...payload })
      return new Promise((resolve, reject) => {
        this.client.publish(this.topic.trim() || FALLBACK_TOPIC, message, { qos: 0 }, (err) => {
          if (err) {
            this.error = err?.message || 'Gagal mem-publish pesan'
            this.addLog('Gagal publish', { event, error: this.error })
            reject(err)
          } else {
            this.error = null
            this.addLog(event, payload)
            resolve()
          }
        })
      })
    },

    resetUrl() {
      this.url = this.backendBroker ?? FALLBACK_URL
      this.topic = FALLBACK_TOPIC
      this.userEditedUrl = false
      this.userEditedTopic = false
    },

    addLog(label, payload) {
      this.log.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        payload: payload ? JSON.stringify(payload) : '',
        time: new Date().toISOString(),
      })
      if (this.log.length > MAX_LOG) this.log.length = MAX_LOG
    },
  },
})