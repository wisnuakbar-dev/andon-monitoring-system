<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6 gap-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Andon</h1>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-xs font-bold uppercase tracking-wider dark:bg-slate-700 dark:hover:bg-slate-600"
          :disabled="store.loading"
          @click="store.refresh()"
        >
          {{ store.loading ? 'Memuat...' : 'Refresh' }}
        </button>
        <router-link
          to="/andon-monitoring"
          class="px-3 py-1.5 rounded bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
        >
          Papan Monitoring
        </router-link>
      </div>
    </div>

    <div
      v-if="store.error || accessDenied"
      class="mb-6 px-4 py-2 rounded border border-red-500 bg-red-50 text-sm font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300"
    >
      {{ accessDenied || store.error }}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Mesin Bermasalah</p>
        <p class="text-3xl font-bold" :class="store.hasStoppage ? 'text-andon-red' : 'text-andon-green'">
          {{ store.activeCount }}
        </p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Total Laporan</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ store.stats.total }}</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Total Downtime</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ store.stats.downtimeMinutes }}
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">menit</span>
        </p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Status</p>
        <p class="text-3xl font-bold" :class="store.hasStoppage ? 'text-andon-yellow' : 'text-andon-green'">
          {{ store.hasStoppage ? 'ADA HAMBATAN' : 'NORMAL' }}
        </p>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 mb-6 border border-gray-200 dark:border-slate-700">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold text-gray-900 dark:text-white">Status Mesin</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ store.downMachines.length }} bermasalah &middot; {{ store.idleMachines.length }} tanpa data
        </p>
      </div>

      <p v-if="!store.machines.length" class="text-gray-400 dark:text-gray-500">
        {{ store.loading ? 'Memuat data realtime...' : 'Belum ada mesin terdaftar.' }}
      </p>
      <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <li
          v-for="machine in store.machines"
          :key="machine.machineId"
          class="flex items-center justify-between p-3 rounded-md"
          :class="statusClass(machine)"
        >
          <div class="min-w-0">
            <p class="font-semibold">{{ machine.machineCode }} &middot; {{ machine.machineName }}</p>
            <p class="text-sm">
              {{ machine.location || 'Tanpa lokasi' }} &middot; {{ statusLabel(machine) }}
            </p>
          </div>
          <div class="text-right shrink-0 ml-3">
            <p class="text-sm font-bold tabular-nums">{{ machine.outputQty }} pcs</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {{ machine.lastEventAt ? formatTime(machine.lastEventAt) : 'belum ada laporan' }}
            </p>
          </div>
        </li>
      </ul>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <h2 class="font-semibold text-gray-900 dark:text-white mb-4">Komposisi Downtime</h2>
        <p v-if="!store.downtimeByCategory.length" class="text-gray-400 dark:text-gray-500">
          Tidak ada downtime tercatat.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="row in store.downtimeByCategory"
            :key="row.category"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-700 dark:text-gray-300">{{ row.category }}</span>
            <span class="tabular-nums font-bold">{{ row.minutes }} menit ({{ row.percentage }}%)</span>
          </li>
        </ul>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <h2 class="font-semibold text-gray-900 dark:text-white mb-4">Top Defect</h2>
        <p v-if="!store.topDefects.length" class="text-gray-400 dark:text-gray-500">
          Tidak ada defect tercatat.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="defect in store.topDefects"
            :key="`${defect.itemCode}-${defect.defectCode}`"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-700 dark:text-gray-300 truncate">{{ defect.defectName }}</span>
            <span class="tabular-nums font-bold">{{ defect.qty }} pcs</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useAndonStore } from '@/stores/andon'
import { useRoute } from 'vue-router'

const store = useAndonStore()
const route = useRoute()

const accessDenied = computed(() => {
  if (route.query.accessDenied) {
    return 'Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman tersebut.'
  }
  return ''
})

const statusClass = (machine) => {
  if (!machine.isActive) return 'bg-gray-100 dark:bg-slate-700/40'
  if (machine.lastResult === null || machine.lastResult === undefined) {
    return 'bg-amber-50 dark:bg-amber-900/40'
  }
  if (['BREAKDOWN', 'DOWNTIME', 'IDLE', 'REJECT'].includes(machine.lastResult) || machine.lastDowntimeMinutes > 0) {
    return 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  }
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
}

const statusLabel = (machine) => {
  if (!machine.isActive) return 'NON-AKTIF'
  if (machine.lastResult === null || machine.lastResult === undefined) return 'TANPA DATA'
  return machine.lastResult
}

const formatTime = (value) =>
  new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

onMounted(() => {
  store.fetchSnapshot()
})
</script>
