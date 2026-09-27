import { defineStore } from 'pinia'
import api from '@/services/api'

const toDateInput = (date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const defaultRange = () => {
  const to = new Date()
  const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000)
  return { from: toDateInput(from), to: toDateInput(to) }
}

export const useAnalyticsStore = defineStore('analytics', {
  state: () => ({
    summary: null,
    loading: false,
    error: null,
    filters: {
      from: defaultRange().from,
      to: defaultRange().to,
      shiftId: '',
      machineId: '',
      itemId: '',
    },
    rawLogs: [],
    rawMeta: { page: 1, limit: 25, total: 0, totalPages: 1 },
    rawLoading: false,
    rawError: null,
  }),
  getters: {
    totals: (state) => state.summary?.totals ?? null,
    byDay: (state) => state.summary?.byDay ?? [],
    byShift: (state) => state.summary?.byShift ?? [],
    defectPareto: (state) => state.summary?.defectPareto?.list ?? [],
    downtimeByCategory: (state) => state.summary?.downtimeByCategory ?? [],
    hasData: (state) => (state.summary?.totals?.logCount ?? 0) > 0,
  },
  actions: {
    buildRangeParams() {
      return {
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        shiftId: this.filters.shiftId || undefined,
        machineId: this.filters.machineId || undefined,
        itemId: this.filters.itemId || undefined,
      }
    },
    async fetchSummary() {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get('/analytics/summary', { params: this.buildRangeParams() })
        this.summary = data
        return data
      } catch (err) {
        this.error = err?.response?.data?.message || 'Gagal memuat ringkasan analitik'
        this.summary = null
        throw err
      } finally {
        this.loading = false
      }
    },
    async fetchRawLogs(params = {}, page = 1) {
      this.rawLoading = true
      this.rawError = null
      try {
        const { data } = await api.get('/production-logs', {
          params: { ...this.buildRangeParams(), ...params, page, limit: this.rawMeta.limit },
        })
        this.rawLogs = data.data
        this.rawMeta = data.meta
        return data
      } catch (err) {
        this.rawError = err?.response?.data?.message || 'Gagal memuat data log produksi'
        this.rawLogs = []
        throw err
      } finally {
        this.rawLoading = false
      }
    },
    setLimit(limit) {
      this.rawMeta = { ...this.rawMeta, limit }
    },
    resetFilters() {
      const range = defaultRange()
      this.filters = { from: range.from, to: range.to, shiftId: '', machineId: '', itemId: '' }
    },
  },
})
