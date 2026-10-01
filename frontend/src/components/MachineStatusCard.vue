<template>
  <div
    class="relative rounded-xl border-2 p-3 flex flex-col gap-2 transition-colors duration-500"
    :class="cardClass"
  >
    <span
      v-if="status === 'down'"
      class="absolute inset-0 rounded-xl border-2 border-red-500/60 animate-ping pointer-events-none"
    ></span>

    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-[0.65rem] uppercase tracking-[0.2em] text-white/60 font-semibold">
          {{ machine.machineCode }}
        </p>
        <p class="text-sm font-bold text-white truncate">{{ machine.machineName }}</p>
        <p v-if="machine.location" class="text-[0.65rem] text-white/50 truncate">
          {{ machine.location }}
        </p>
      </div>
      <span class="text-[0.6rem] uppercase tracking-wider text-white/50">{{ machine.isActive ? 'Aktif' : 'Nonaktif' }}</span>
    </div>

    <div class="flex items-end justify-between gap-2">
      <p class="text-3xl font-black uppercase leading-none" :class="statusTextClass">
        {{ statusLabel }}
      </p>
      <p class="text-right text-[0.7rem] leading-tight text-white/70 tabular-nums">
        <span class="block text-lg font-black text-white">{{ machine.outputQty }}</span>
        unit
      </p>
    </div>

    <p class="text-[0.7rem] text-white/70 leading-tight">
      <template v-if="status === 'down'">
        {{ downtimeReason }}
      </template>
      <template v-else-if="status === 'idle'">Belum ada laporan produksi</template>
      <template v-else-if="status === 'off'">Mesin nonaktif</template>
      <template v-else>{{ relativeLastEvent }} &middot; {{ machine.ngQty }} NG</template>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  machine: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
  staleAfterMinutes: { type: Number, default: 15 },
})

const DOWNTIME_RESULTS = ['BREAKDOWN', 'DOWNTIME', 'IDLE']

const isDown = computed(() => {
  if (!props.machine.isActive) return false
  if (!props.machine.lastResult) return false
  if (DOWNTIME_RESULTS.includes(props.machine.lastResult)) return true
  return (props.machine.lastDowntimeMinutes ?? 0) > 0
})

const isStale = computed(() => {
  if (!props.machine.lastEventAt) return true
  return props.now - new Date(props.machine.lastEventAt).getTime() > props.staleAfterMinutes * 60_000
})

const status = computed(() => {
  if (!props.machine.isActive) return 'off'
  if (isDown.value) return 'down'
  if (!props.machine.lastEventAt || isStale.value) return 'idle'
  return 'run'
})

const statusLabel = computed(
  () =>
    ({
      run: 'Running',
      down: 'Down',
      idle: 'No Data',
      off: 'Inactive',
    })[status.value],
)

const statusTextClass = computed(
  () =>
    ({
      run: 'text-emerald-400',
      down: 'text-red-500',
      idle: 'text-amber-400',
      off: 'text-slate-400',
    })[status.value],
)

const cardClass = computed(
  () =>
    ({
      run: 'bg-emerald-950/60 border-emerald-600/70',
      down: 'bg-red-950/80 border-red-600',
      idle: 'bg-amber-950/60 border-amber-600/70',
      off: 'bg-slate-900/70 border-slate-700',
    })[status.value],
)

const downtimeReason = computed(() => {
  const parts = []
  if (props.machine.lastResult) parts.push(props.machine.lastResult)
  if (props.machine.lastDowntimeCategory) parts.push(props.machine.lastDowntimeCategory)
  const minutes = props.machine.lastDowntimeMinutes ?? 0
  if (minutes > 0) parts.push(`${minutes} menit`)
  return parts.length ? parts.join(' · ') : 'Mesin berhenti'
})

const relativeLastEvent = computed(() => {
  if (!props.machine.lastEventAt) return 'Belum ada data'
  const diff = Math.max(0, props.now - new Date(props.machine.lastEventAt).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  return `${hours} jam lalu`
})
</script>
