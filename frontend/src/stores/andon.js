import { defineStore } from 'pinia'
import api from '@/services/api'

// Backend tidak punya endpoint /api/andon/*, jadi isi kartu andon di halaman
// dashboard diambil dari snapshot KPI yang sama dengan papan /andon-monitoring.
const PROBLEM_RESULTS = new Set(['BREAKDOWN', 'DOWNTIME', 'IDLE', 'REJECT'])

const hasResult = (machine) => machine.lastResult !== null && machine.lastResult !== undefined

// Mesin bermasalah: laporan terakhir menunjukkan problem atau punya downtime.
const isDown = (machine) =>
  machine.isActive &&
  hasResult(machine) &&
  (PROBLEM_RESULTS.has(machine.lastResult) || (machine.lastDowntimeMinutes ?? 0) > 0)

// Mesin aktif yang belum punya laporan sama sekali.
const isIdle = (machine) => machine.isActive && !hasResult(machine)

export const useAndonStore = defineStore('andon', {
  state: () => ({
    snapshot: null,
    loading: false,
    error: null,
  }),

  getters: {
    machines: (state) => state.snapshot?.machineStatus ?? [],
    totals: (state) => state.snapshot?.totals ?? {},
    downtimeByCategory: (state) => state.snapshot?.downtimeByCategory ?? [],
    topDefects: (state) => state.snapshot?.topDefects ?? [],
    range: (state) => state.snapshot?.range ?? {},
    downMachines: (state) => (state.snapshot?.machineStatus ?? []).filter(isDown),
    idleMachines: (state) => (state.snapshot?.machineStatus ?? []).filter(isIdle),
    activeCount: (state) => (state.snapshot?.machineStatus ?? []).filter(isDown).length,
    hasStoppage: (state) => (state.snapshot?.machineStatus ?? []).some(isDown),
    stats: (state) => {
      const machines = state.snapshot?.machineStatus ?? []
      return {
        total: state.snapshot?.totals?.logCount ?? 0,
        downtimeMinutes: state.snapshot?.totals?.downtimeMinutes ?? 0,
        down: machines.filter(isDown).length,
        idle: machines.filter(isIdle).length,
      }
    },
  },

  actions: {
    async fetchSnapshot(params = { rangeDays: 1 }) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get('/realtime/kpi', { params })
        this.snapshot = data
        return data
      } catch (err) {
        // 401 sudah ditangani interceptor axios (logout + redirect ke /login).
        if (err?.response?.status !== 401) {
          this.error = err?.response?.data?.message || 'Gagal memuat data andon'
        }
        return null
      } finally {
        this.loading = false
      }
    },

    refresh(params = { rangeDays: 1 }) {
      return this.fetchSnapshot(params)
    },
  },
})
