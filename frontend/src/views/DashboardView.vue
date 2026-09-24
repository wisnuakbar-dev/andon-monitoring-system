<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard Andon</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Andon Aktif</p>
        <p class="text-3xl font-bold" :class="store.hasStoppage ? 'text-andon-red' : 'text-andon-green'">
          {{ store.activeCount }}
        </p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Peristiwa Total</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ store.stats.total }}</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
        <p class="text-gray-500 dark:text-gray-400 text-sm">Status</p>
        <p class="text-3xl font-bold" :class="store.hasStoppage ? 'text-andon-yellow' : 'text-andon-green'">
          {{ store.hasStoppage ? 'ADA HAMBATAN' : 'NORMAL' }}
        </p>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5 border border-gray-200 dark:border-slate-700">
      <h2 class="font-semibold text-gray-900 dark:text-white mb-4">Andon Aktif Saat Ini</h2>
      <p v-if="!store.events.length" class="text-gray-400 dark:text-gray-500">Tidak ada andon aktif.</p>
      <ul v-else class="space-y-2">
        <li
          v-for="event in store.events"
          :key="event.id"
          class="flex items-center justify-between p-3 rounded-md"
          :class="typeClass(event.type)"
        >
          <div>
            <p class="font-semibold">{{ event.machine.name }}</p>
            <p class="text-sm">{{ event.machine.department.name }} - {{ event.type }}</p>
          </div>
          <button
            class="bg-black text-white text-sm font-bold px-3 py-1 rounded-md hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
            @click="store.resolveEvent(event.id)"
          >
            Selesai
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAndonStore } from '@/stores/andon'

const store = useAndonStore()

const typeClass = (type) => {
  if (type === 'STOPPED' || type === 'DOWNTIME') return 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (type === 'WARNING') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
}

onMounted(() => {
  store.fetchEvents()
  store.fetchStats()
})
</script>