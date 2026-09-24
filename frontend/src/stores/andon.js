import { defineStore } from 'pinia'
import api from '@/services/api'

export const useAndonStore = defineStore('andon', {
  state: () => ({
    events: [],
    stats: { active: 0, resolved: 0, total: 0, byType: [] },
    loading: false,
  }),
  getters: {
    activeCount: (state) => state.events.length,
    hasStoppage: (state) => state.events.some((e) => e.type === 'STOPPED' || e.type === 'DOWNTIME'),
  },
  actions: {
    async fetchEvents() {
      this.loading = true
      try {
        const { data } = await api.get('/andon/events/active')
        this.events = data
      } finally {
        this.loading = false
      }
    },
    async fetchStats() {
      const { data } = await api.get('/andon/stats')
      this.stats = data
    },
    async createEvent(payload) {
      const { data } = await api.post('/andon/events', payload)
      await this.fetchEvents()
      return data
    },
    async resolveEvent(id) {
      await api.post(`/andon/events/${id}/resolve`)
      await this.fetchEvents()
    },
  },
})