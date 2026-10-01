<template>
  <div class="min-h-screen bg-black text-white font-sans">
    <!-- Header: judul, koneksi, jam, kontrol -->
    <header class="border-b-2 border-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-950/80">
      <div class="flex items-center gap-3">
        <span class="h-4 w-4 rounded-full" :class="statusDotClass"></span>
        <div>
          <h1 class="text-xl font-black uppercase tracking-[0.2em] leading-none">
            Andon Monitoring
          </h1>
          <p class="text-[0.65rem] uppercase tracking-[0.2em] text-white/50 mt-1">
            {{ connectionLabel }}
          </p>
        </div>
      </div>

      <div class="flex items-baseline gap-2 ml-auto">
        <span class="text-3xl font-black tabular-nums leading-none">{{ clock }}</span>
        <span class="text-xs uppercase tracking-widest text-white/50">{{ clockDate }}</span>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="rangeDays"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-semibold"
          @change="applyScope"
        >
          <option v-for="option in rangeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <select
          v-model="machineId"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-semibold max-w-[10rem]"
          @change="applyScope"
        >
          <option value="">Semua Mesin</option>
          <option v-for="machine in machineOptions" :key="machine.machineId" :value="machine.machineId">
            {{ machine.machineCode }}
          </option>
        </select>

        <button
          class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider"
          @click="realtime.refresh()"
        >
          Refresh
        </button>
        <button
          class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? 'Keluar Layar' : 'Layar Penuh' }}
        </button>
      </div>
    </header>

    <!-- Error -->
    <div
      v-if="realtime.error"
      class="mx-4 mt-3 px-4 py-2 rounded border border-red-600 bg-red-950/70 text-sm font-semibold text-red-200"
    >
      {{ realtime.error }}
    </div>

    <!-- Loading: hanya selama belum ada satu pun data -->
    <div v-if="realtime.isBootstrapping" class="p-10 text-center text-xl font-bold text-white/50">
      Menyiapkan data realtime...
    </div>

    <!-- Gagal: data tidak pernah sampai, jangan sampai menggantung di layar hitam -->
    <div v-else-if="!snapshot" class="p-10 text-center space-y-3">
      <p class="text-xl font-bold text-white/60">Data realtime belum tersedia.</p>
      <p class="text-sm text-white/40">{{ realtime.error || 'Server tidak mengirim snapshot KPI.' }}</p>
      <button
        class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider"
        @click="realtime.refresh()"
      >
        Coba lagi
      </button>
    </div>

    <main v-else class="p-3 space-y-3">
      <!-- KPI utama -->
      <section class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Output vs Target"
          :value="formatNumber(totals.totalQty)"
          unit="pcs"
          :sub="`Target ${formatNumber(totals.targetQuantity)} pcs · ${formatPercent(achievement)}`"
          :progress="achievement"
          :tone="toneByPercent(achievement)"
        />
        <KpiTile
          label="Defect"
          :value="formatNumber(defectQty)"
          unit="pcs"
          :sub="`NG ${formatNumber(totals.ngQty)} · Reject ${formatNumber(totals.rejectQty)}`"
          :hint="`${formatPercent(defectRate)} dari output`"
          :tone="defectRate > 5 ? 'bad' : defectRate > 0 ? 'warn' : 'good'"
        />
        <KpiTile
          label="Quality Rate"
          :value="formatPercent(oee.quality)"
          :progress="oee.quality"
          :tone="toneByPercent(oee.quality, 99, 95)"
          :sub="`${formatNumber(totals.okQty)} unit OK dari ${formatNumber(totals.totalQty)}`"
        />
        <KpiTile
          label="OEE"
          :value="formatPercent(oee.oee)"
          :progress="oee.oee"
          :tone="toneByPercent(oee.oee, 85, 65)"
          :sub="`A ${formatPercent(oee.availability)} · P ${formatPercent(oee.performance)} · Q ${formatPercent(oee.quality)}`"
        />
        <KpiTile
          label="Total Downtime"
          :value="formatNumber(totals.downtimeMinutes)"
          unit="menit"
          :hint="`${totals.logCount} laporan`"
          :sub="topDowntimeLabel"
          :tone="totals.downtimeMinutes > 0 ? 'bad' : 'good'"
        />
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <!-- Papan status mesin -->
        <div class="xl:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-black uppercase tracking-[0.2em]">Status Mesin</h2>
            <p class="text-xs text-white/60 tabular-nums">
              <span class="text-emerald-400 font-bold">{{ machineSummary.run }}</span> jalan ·
              <span class="text-red-500 font-bold">{{ machineSummary.down }}</span> down ·
              <span class="text-amber-400 font-bold">{{ machineSummary.idle }}</span> tanpa data
            </p>
          </div>

          <div v-if="machineStatus.length" class="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2">
            <MachineStatusCard
              v-for="machine in machineStatus"
              :key="machine.machineId"
              :machine="machine"
              :now="now"
            />
          </div>
          <p v-else class="py-8 text-center text-sm text-white/50">
            Belum ada mesin terdaftar atau tidak ada mesin dalam scope ini.
          </p>
        </div>

        <!-- Output per mesin + downtime -->
        <div class="space-y-3">
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <h2 class="text-sm font-black uppercase tracking-[0.2em] mb-2">Output per Mesin</h2>
            <ChartCanvas
              type="bar"
              :labels="machineChartLabels"
              :datasets="machineChartDatasets"
              :options="machineChartOptions"
              height="220px"
              empty-text="Belum ada output pada rentang ini."
            />
          </div>

          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <h2 class="text-sm font-black uppercase tracking-[0.2em] mb-2">Komposisi Downtime</h2>
            <ChartCanvas
              type="doughnut"
              :labels="downtimeLabels"
              :datasets="downtimeDatasets"
              :options="downtimeOptions"
              height="180px"
              empty-text="Tidak ada downtime tercatat."
            />
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <!-- Grafik planning -->
        <div class="xl:col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-black uppercase tracking-[0.2em]">Grafik Planning vs Realisasi</h2>
            <p class="text-xs text-white/60">
              Kumulatif per jam &middot; {{ planningRangeLabel }}
            </p>
          </div>
          <ChartCanvas
            type="line"
            :labels="planningLabels"
            :datasets="planningDatasets"
            :options="planningOptions"
            height="260px"
            empty-text="Belum ada laporan produksi pada rentang ini."
          />
        </div>

        <!-- Pareto defect -->
        <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <h2 class="text-sm font-black uppercase tracking-[0.2em] mb-2">Top Defect</h2>
          <ChartCanvas
            type="bar"
            :labels="defectLabels"
            :datasets="defectDatasets"
            :options="defectOptions"
            height="200px"
            empty-text="Tidak ada defect tercatat."
          />
          <ul v-if="topDefects.length" class="mt-2 space-y-1">
            <li
              v-for="defect in topDefects.slice(0, 4)"
              :key="`${defect.itemCode}-${defect.defectCode}`"
              class="flex items-center justify-between text-xs"
            >
              <span class="truncate text-white/80">{{ defect.defectName }}</span>
              <span class="tabular-nums font-bold" :class="defect.isVitalFew ? 'text-red-400' : 'text-amber-300'">
                {{ formatNumber(defect.qty) }} pcs
              </span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Latest event -->
      <section class="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-black uppercase tracking-[0.2em]">Aktivitas Terbaru</h2>
          <p class="text-xs text-white/50 tabular-nums">
            Update {{ updatedAgo }} &middot; {{ realtime.updateCount }} push diterima
          </p>
        </div>

        <ul v-if="recentLogs.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <li
            v-for="log in recentLogs"
            :key="log.id"
            class="flex items-center gap-3 px-3 py-2 rounded-lg border"
            :class="logClass(log)"
          >
            <span class="text-xs font-bold tabular-nums text-white/70">{{ formatTime(log.loggedAt) }}</span>
            <span class="text-xs font-black uppercase">{{ log.workOrder?.machine?.code ?? '-' }}</span>
            <span class="text-xs font-bold uppercase">{{ log.result }}</span>
            <span class="ml-auto text-xs tabular-nums text-white/80">{{ logSummary(log) }}</span>
          </li>
        </ul>
        <p v-else class="py-6 text-center text-sm text-white/50">Belum ada laporan produksi.</p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ChartCanvas from '@/components/ChartCanvas.vue'
import KpiTile from '@/components/KpiTile.vue'
import MachineStatusCard from '@/components/MachineStatusCard.vue'
import { useRealtimeStore } from '@/stores/realtime'

const realtime = useRealtimeStore()

const rangeOptions = [
  { value: 1, label: 'Hari Ini' },
  { value: 7, label: '7 Hari' },
  { value: 30, label: '30 Hari' },
]

const rangeDays = ref(1)
const machineId = ref('')
const clock = ref('')
const clockDate = ref('')
const now = ref(Date.now())
const isFullscreen = ref(false)

let clockTimer = null

const snapshot = computed(() => realtime.snapshot)
const totals = computed(() => snapshot.value?.totals ?? {})
const oee = computed(() => totals.value.oee ?? {})
const byHour = computed(() => snapshot.value?.byHour ?? [])
const machineStatus = computed(() => snapshot.value?.machineStatus ?? [])
const topDefects = computed(() => snapshot.value?.topDefects ?? [])
const downtimeByCategory = computed(() => snapshot.value?.downtimeByCategory ?? [])
const recentLogs = computed(() => snapshot.value?.recentLogs ?? [])
const range = computed(() => snapshot.value?.range ?? {})
const timezone = computed(() => range.value.timezone || undefined)

const defectQty = computed(() => (totals.value.ngQty ?? 0) + (totals.value.rejectQty ?? 0))

const defectRate = computed(() => {
  const total = totals.value.totalQty ?? 0
  return total > 0 ? (defectQty.value / total) * 100 : 0
})

const achievement = computed(() => {
  const target = totals.value.targetQuantity ?? 0
  return target > 0 ? ((totals.value.okQty ?? 0) / target) * 100 : 0
})

const machineOptions = computed(() => machineStatus.value)

const machineSummary = computed(() => {
  const summary = { run: 0, down: 0, idle: 0 }
  for (const machine of machineStatus.value) {
    if (!machine.isActive) continue
    if (machine.lastResult === null || machine.lastResult === undefined) {
      summary.idle += 1
    } else if (['BREAKDOWN', 'DOWNTIME', 'IDLE'].includes(machine.lastResult) || machine.lastDowntimeMinutes > 0) {
      summary.down += 1
    } else {
      summary.run += 1
    }
  }
  return summary
})

const topDowntimeLabel = computed(() => {
  const top = downtimeByCategory.value[0]
  if (!top) return 'Tidak ada downtime'
  return `Terbesar: ${top.category} ${top.minutes} menit`
})

const planningRangeLabel = computed(() => {
  if (!snapshot.value) return ''
  const from = new Date(range.value.from)
  const to = new Date(range.value.to)
  const fmt = (date) => date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return `${fmt(from)} - ${fmt(to)}`
})

const hourLabel = (hour) => {
  const [, time] = hour.split(' ')
  return range.value.days > 1 ? `${hour.slice(8, 10)} ${time}` : time
}

const planningLabels = computed(() => byHour.value.map((row) => hourLabel(row.hour)))

// Rencana linear: target dibagi rata pada menit kerja yang sudah terpakai
const plannedCumulative = computed(() => {
  const target = totals.value.targetQuantity ?? 0
  const plannedMinutes = totals.value.plannedMinutes ?? 0
  if (target <= 0 || plannedMinutes <= 0) return []

  const from = new Date(range.value.from).getTime()
  const to = new Date(range.value.to).getTime()
  const windowMinutes = Math.max(1, (to - from) / 60_000)
  const factor = windowMinutes / plannedMinutes

  let cumulative = 0
  return byHour.value.map((row) => {
    // bucket jam dihitung per zona laporan; konversi lewat offset tanggal
    const bucketStart = new Date(`${row.hour.replace(' ', 'T')}:00Z`).getTime() - timezoneOffsetMinutes()
    const bucketEnd = bucketStart + 60_000
    const elapsed = Math.min(windowMinutes, Math.max(0, (Math.min(bucketEnd, now.value) - from) / 60_000))
    cumulative = target * Math.min(1, (elapsed * factor) / windowMinutes)
    return Math.round(cumulative)
  })
})

function timezoneOffsetMinutes() {
  if (!range.value.from) return 0
  const date = new Date(range.value.from)
  return date.getTimezoneOffset()
}

const planningDatasets = computed(() => [
  {
    label: 'Rencana',
    data: plannedCumulative.value,
    borderColor: '#38bdf8',
    backgroundColor: '#38bdf8',
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 0,
    tension: 0.1,
  },
  {
    label: 'Realisasi OK',
    data: cumulativeOk.value,
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
    borderWidth: 3,
    pointRadius: 2,
    pointBackgroundColor: '#22c55e',
    tension: 0.3,
  },
  {
    label: 'Realisasi NG',
    data: cumulativeNg.value,
    borderColor: '#ef4444',
    backgroundColor: '#ef4444',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
  },
])

const cumulativeOk = computed(() => {
  let sum = 0
  return byHour.value.map((row) => (sum += row.okQty))
})

const cumulativeNg = computed(() => {
  let sum = 0
  return byHour.value.map((row) => (sum += row.ngQty + row.rejectQty))
})

const planningOptions = computed(() => ({
  animation: false,
  plugins: {
    legend: { labels: { color: '#e2e8f0', boxWidth: 12, font: { size: 11 } } },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 12 },
      grid: { color: 'rgba(148,163,184,0.15)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 },
      grid: { color: 'rgba(148,163,184,0.15)' },
    },
  },
}))

const machineChartLabels = computed(() =>
  machineStatus.value.map((machine) => machine.machineCode),
)

const machineChartDatasets = computed(() => [
  {
    label: 'OK',
    data: machineStatus.value.map((machine) => machine.okQty),
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },
  {
    label: 'NG',
    data: machineStatus.value.map((machine) => machine.ngQty),
    backgroundColor: '#ef4444',
    borderRadius: 3,
  },
])

const machineChartOptions = computed(() => ({
  indexAxis: 'y',
  animation: false,
  plugins: {
    legend: { labels: { color: '#e2e8f0', boxWidth: 12, font: { size: 11 } } },
  },
  scales: {
    x: {
      stacked: true,
      beginAtZero: true,
      ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 },
      grid: { color: 'rgba(148,163,184,0.15)' },
    },
    y: {
      stacked: true,
      ticks: { color: '#e2e8f0', font: { size: 10 } },
      grid: { display: false },
    },
  },
}))

const downtimeLabels = computed(() => downtimeByCategory.value.map((row) => row.category))
const downtimeDatasets = computed(() => [
  {
    data: downtimeByCategory.value.map((row) => row.minutes),
    backgroundColor: ['#ef4444', '#f59e0b', '#38bdf8', '#a855f7', '#22c55e'],
    borderColor: '#0f172a',
    borderWidth: 2,
  },
])

const downtimeOptions = computed(() => ({
  animation: false,
  plugins: {
    legend: { position: 'right', labels: { color: '#e2e8f0', boxWidth: 12, font: { size: 11 } } },
  },
}))

const defectLabels = computed(() => topDefects.value.map((defect) => defect.defectCode))
const defectDatasets = computed(() => [
  {
    label: 'Jumlah NG',
    data: topDefects.value.map((defect) => defect.qty),
    backgroundColor: topDefects.value.map((defect) => (defect.isVitalFew ? '#ef4444' : '#f59e0b')),
    borderRadius: 3,
  },
])

const defectOptions = computed(() => ({
  indexAxis: 'y',
  animation: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { color: '#94a3b8', font: { size: 10 }, precision: 0 },
      grid: { color: 'rgba(148,163,184,0.15)' },
    },
    y: {
      ticks: { color: '#e2e8f0', font: { size: 10 } },
      grid: { display: false },
    },
  },
}))

// Status yang ditampilkan: socket boleh gagal selama REST masih menyediakan data,
// jadi status "gagal" baru tampil ketika tidak ada sumber data sama sekali.
const connectionTone = computed(() => {
  if (realtime.status === 'unauthorized') return 'unauthorized'
  if (realtime.isConnected) return 'connected'
  if (realtime.status === 'reconnecting') return 'reconnecting'
  if (realtime.error) return 'error'
  return 'connecting'
})

const statusDotClass = computed(
  () =>
    ({
      connected: 'bg-emerald-500',
      connecting: 'bg-amber-400 animate-pulse',
      reconnecting: 'bg-amber-400 animate-pulse',
      error: 'bg-red-500',
      unauthorized: 'bg-red-500',
    })[connectionTone.value] ?? 'bg-slate-500',
)

const connectionLabel = computed(() => {
  const updated = realtime.receivedAt
    ? `terakhir ${new Date(realtime.receivedAt).toLocaleTimeString('id-ID', { hour12: false })}`
    : 'menunggu data'
  if (realtime.status === 'unauthorized') return 'Sesi berakhir'
  if (realtime.isConnected) return `Realtime aktif · ${updated}`
  // Data REST sudah tampil padahal socket belum tersambung: jangan sebut "aktif".
  if (realtime.hasData) return `Mode polling · ${updated}`
  if (realtime.error) return 'Koneksi gagal'
  return 'Menghubungkan...'
})

const updatedAgo = computed(() => {
  if (!realtime.receivedAt) return '-'
  const seconds = Math.max(0, Math.round((now.value - new Date(realtime.receivedAt).getTime()) / 1000))
  if (seconds < 60) return `${seconds} detik lalu`
  return `${Math.floor(seconds / 60)} menit lalu`
})

function toneByPercent(value, good = 100, warn = 90) {
  if (value >= good) return 'good'
  if (value >= warn) return 'warn'
  return 'bad'
}

const formatNumber = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0)
const formatPercent = (value) =>
  value === null || value === undefined ? '-' : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)}%`

function formatTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function logClass(log) {
  if (log.result === 'OK') return 'border-emerald-700/60 bg-emerald-950/50'
  if (log.result === 'NG') return 'border-red-700/60 bg-red-950/50'
  return 'border-amber-700/60 bg-amber-950/50'
}

// recentLogs memakai field schema ProductionLog: goodQty / ngQty (bukan okQty).
function logSummary(log) {
  const parts = []
  const goodQty = log.goodQty ?? 0
  const ngQty = log.ngQty ?? 0
  if (goodQty || ngQty) parts.push(`${goodQty} OK${ngQty ? ` · ${ngQty} NG` : ''}`)
  if (log.downtimeMinutes > 0) parts.push(`${log.downtimeMinutes} menit`)
  return parts.join(' · ') || '-'
}

function applyScope() {
  realtime.subscribe({
    rangeDays: rangeDays.value,
    timezone: timezone.value,
    machineId: machineId.value || undefined,
  })
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen().catch(() => {})
  }
}

function syncFullscreen() {
  isFullscreen.value = !!document.fullscreenElement
}

function tick() {
  const ts = Date.now()
  now.value = ts
  const d = new Date(ts)
  clock.value = d.toLocaleTimeString('id-ID', { hour12: false })
  clockDate.value = d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

onMounted(() => {
  realtime.connect({ rangeDays: rangeDays.value, timezone: timezone.value })
  tick()
  clockTimer = window.setInterval(tick, 1000)
  document.addEventListener('fullscreenchange', syncFullscreen)
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  document.removeEventListener('fullscreenchange', syncFullscreen)
  realtime.reset()
})
</script>
