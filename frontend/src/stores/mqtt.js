import { defineStore } from 'pinia'
import mqtt from 'mqtt'

const DEFAULT_URL = 'wss://test.mosquitto.org:8081/mqtt'
const DEFAULT_TOPIC = 'andon/simulator'
const MAX_LOG = 50

export const useMqttStore = defineStore('mqtt', {
  state: () => ({
    client: null,
    status: 'disconnected',
    url: DEFAULT_URL,
    topic: DEFAULT_TOPIC,
    error: null,
    log: [],
  }),
  getters: {
    isConnected: (state) => state.status === 'connected',
    isBusy: (state) => state.status === 'connecting',
  },
  actions: {
    connect() {
      this.disconnect()
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

    disconnect() {
      if (this.client) {
        this.client.end(true)
        this.client = null
      }
      this.status = 'disconnected'
      this.addLog('Terputus dari broker', null)
    },

    publish(event, payload) {
      if (!this.isConnected || !this.client) {
        throw new Error('Belum terhubung ke broker MQTT')
      }
      const message = JSON.stringify({ event, ...payload })
      return new Promise((resolve, reject) => {
        this.client.publish(this.topic.trim() || DEFAULT_TOPIC, message, { qos: 0 }, (err) => {
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
      this.url = DEFAULT_URL
      this.topic = DEFAULT_TOPIC
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