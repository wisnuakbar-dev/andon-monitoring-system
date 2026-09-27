<template>
  <div class="p-6">
    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Production Analytics</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Ruang kerja Supervisor &middot; klik KPI, batang grafik, atau baris Pareto untuk melihat log mentah
        </p>
      </div>
      <div class="text-right shrink-0">
        <button
          class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition disabled:opacity-60"
          :disabled="store.loading"
          @click="loadSummary"
        >
          {{ store.loading ? 'Memuat...' : 'Muat Ulang' }}
        </button>
        <p v-if="lastUpdated" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Diperbarui {{ lastUpdated }}
        </p>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari</label>
        <input
          v-model="store.filters.from"
          type="date"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadSummary"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai</label>
        <input
          v-model="store.filters.to"
          type="date"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadSummary"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Shift</label>
        <select
          v-model="store.filters.shiftId"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadSummary"
        >
          <option value="">Semua Shift</option>
          <option v-for="shift in shifts" :key="shift.id" :value="shift.id">
            {{ shift.code }} - {{ shift.name }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mesin</label>
        <select
          v-model="store.filters.machineId"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadSummary"
        >
          <option value="">Semua Mesin</option>
          <option v-for="machine in machines" :key="machine.id" :value="machine.id">
            {{ machine.code }} - {{ machine.name }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Item</label>
        <select
          v-model="store.filters.itemId"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadSummary"
        >
          <option value="">Semua Item</option>
          <option v-for="item in items" :key="item.id" :value="item.id">
            {{ item.code }} - {{ item.name }}
          </option>
        </select>
      </div>
      <button
        class="px-3 py-2 rounded-lg bg-black text-white font-bold text-sm hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
        @click="handleReset"
      >
        Reset
      </button>
    </div>

    <p
      v-if="store.error"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ store.error }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <button
        v-for="card in kpiCards"
        :key="card.key"
        class="text-left bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-5 transition hover:border-[#e91e63] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        :disabled="!store.hasData"
        @click="openDrillDown(card.drill)"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-gray-500 dark:text-gray-400 text-sm">{{ card.label }}</p>
          <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Drill-down
          </span>
        </div>
        <p class="text-3xl font-bold mt-1 tabular-nums" :class="card.valueClass">
          {{ card.value }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ card.hint }}</p>
      </button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div class="xl:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 class="font-semibold text-gray-900 dark:text-white">Productivity Chart</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Klik batang {{ dimension === 'day' ? 'per tanggal' : 'per shift' }} untuk melihat log mentah
            </p>
          </div>
          <div class="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden text-xs font-semibold">
            <button
              v-for="option in dimensionOptions"
              :key="option.value"
              class="px-3 py-1.5 transition"
              :class="dimension === option.value ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'"
              @click="dimension = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <ChartCanvas
          type="bar"
          clickable
          :labels="productivityLabels"
          :datasets="productivityDatasets"
          :options="productivityOptions"
          height="300px"
          empty-text="Belum ada log produksi pada rentang ini."
          @select="handleProductivityClick"
        />
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-5">
        <div class="mb-4">
          <h2 class="font-semibold text-gray-900 dark:text-white">Pareto Defect</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Klik batang defect untuk melihat lognya</p>
        </div>

        <ChartCanvas
          type="bar"
          clickable
          :labels="paretoLabels"
          :datasets="paretoDatasets"
          :options="paretoOptions"
          height="240px"
          empty-text="Belum ada defect tercatat pada rentang ini."
          @select="handleParetoClick"
        />

        <ul v-if="store.defectPareto.length" class="mt-4 space-y-1.5">
          <li
            v-for="defect in store.defectPareto"
            :key="`${defect.itemCode}-${defect.defectCode}`"
          >
            <button
              class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition hover:bg-gray-100 dark:hover:bg-slate-700"
              @click="openDefect(defect)"
            >
              <span class="min-w-0">
                <span class="font-semibold text-gray-900 dark:text-white">{{ defect.defectName }}</span>
                <span class="text-gray-500 dark:text-gray-400"> &middot; {{ defect.defectCode }}</span>
                <span v-if="defect.isVitalFew" class="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold dark:bg-red-900/40 dark:text-red-300">
                  vital few
                </span>
              </span>
              <span class="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                {{ defect.qty }} pcs &middot; {{ defect.percentage }}%
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div class="xl:col-span-3 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-5">
        <div class="mb-4">
          <h2 class="font-semibold text-gray-900 dark:text-white">Downtime per Kategori</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Klik kategori untuk melihat kejadian downtime</p>
        </div>

        <p v-if="!store.downtimeByCategory.length" class="text-sm text-gray-400 dark:text-gray-500">
          Belum ada downtime tercatat pada rentang ini.
        </p>
        <div v-else class="space-y-2">
          <button
            v-for="row in store.downtimeByCategory"
            :key="row.category"
            class="w-full text-left group"
            @click="openDowntime(row)"
          >
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-semibold text-gray-900 dark:text-white group-hover:text-[#e91e63] transition">
                {{ row.category }}
              </span>
              <span class="text-gray-500 dark:text-gray-400 tabular-nums">
                {{ row.minutes }} menit &middot; {{ row.events }} kejadian &middot; {{ row.percentage }}%
              </span>
            </div>
            <div class="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
              <div class="h-full bg-andon-yellow rounded-full" :style="{ width: `${row.percentage}%` }"></div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <DrillDownModal
      v-model="drillOpen"
      :title="drill.title"
      :description="drill.description"
      :logs="store.rawLogs"
      :loading="store.rawLoading"
      :error="store.rawError"
      :page="store.rawMeta.page"
      :total="store.rawMeta.total"
      :total-pages="store.rawMeta.totalPages"
      :limit="store.rawMeta.limit"
      :timezone="store.summary?.range?.timezone"
      @page-change="handlePageChange"
      @limit-change="handleLimitChange"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import ChartCanvas from '@/components/ChartCanvas.vue'
import DrillDownModal from '@/components/DrillDownModal.vue'
import { useAnalyticsStore } from '@/stores/analytics'

const store = useAnalyticsStore()

const shifts = ref([])
const machines = ref([])
const items = ref([])
const lastUpdated = ref('')
const dimension = ref('day')
const drillOpen = ref(false)
const drill = ref({ title: '', description: '', params: {} })

const dimensionOptions = [
  { value: 'day', label: 'Per Hari' },
  { value: 'shift', label: 'Per Shift' },
]

const formatNumber = (value) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value ?? 0)

const formatPercent = (value) => (value === null || value === undefined ? '-' : `${formatNumber(value)}%`)

const formatDateLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

const qualityClass = (value) => {
  if (value === null || value === undefined) return 'text-gray-400 dark:text-gray-500'
  if (value >= 85) return 'text-andon-green'
  if (value >= 70) return 'text-andon-yellow'
  return 'text-andon-red'
}

const basisLabel = computed(() => {
  const basis = store.totals?.oee?.performanceBasis
  if (basis === 'CYCLE_TIME') return 'berdasarkan cycle time'
  if (basis === 'TARGET') return 'berdasarkan target'
  return 'belum ada data'
})

const kpiCards = computed(() => {
  const oee = store.totals?.oee
  return [
    {
      key: 'oee',
      label: 'OEE',
      value: formatPercent(oee?.oee),
      valueClass: qualityClass(oee?.oee),
      hint: 'Produktivitas overall equipment',
      drill: {
        title: 'Log pembentuk OEE',
        description: `Seluruh ${formatNumber(store.totals?.logCount)} log pada rentang ini menghasilkan OEE ${formatPercent(oee?.oee)}.`,
        params: {},
      },
    },
    {
      key: 'availability',
      label: 'Availability',
      value: formatPercent(oee?.availability),
      valueClass: qualityClass(oee?.availability),
      hint: `${formatNumber(oee?.downtimeMinutes)} menit downtime dari ${formatNumber(oee?.plannedMinutes)} menit rencana`,
      drill: {
        title: 'Kejadian downtime pembentuk Availability',
        description: `${formatNumber(oee?.downtimeMinutes)} menit downtime tercatat pada ${formatNumber(oee?.plannedMinutes)} menit waktu rencana.`,
        params: { hasDowntime: true },
      },
    },
    {
      key: 'performance',
      label: 'Performance',
      value: formatPercent(oee?.performance),
      valueClass: qualityClass(oee?.performance),
      hint: basisLabel.value,
      drill: {
        title: 'Log pembentuk Performance',
        description: `Log dengan data cycle time (ideal ${formatNumber(store.totals?.idealCycleTimeSeconds)} detik).`,
        params: { hasCycleTime: true },
      },
    },
    {
      key: 'quality',
      label: 'Quality',
      value: formatPercent(oee?.quality),
      valueClass: qualityClass(oee?.quality),
      hint: `${formatNumber(store.totals?.okQty)} OK dari ${formatNumber(store.totals?.totalQty)} unit`,
      drill: {
        title: 'Log NG / REJECT pembentuk Quality',
        description: `${formatNumber(store.totals?.ngQty)} unit NG dan ${formatNumber(store.totals?.rejectQty)} unit REJECT dari ${formatNumber(store.totals?.totalQty)} unit produksi.`,
        params: { result: 'NG,REJECT' },
      },
    },
  ]
})

const productivityRows = computed(() => (dimension.value === 'day' ? store.byDay : store.byShift))

const productivityLabels = computed(() =>
  productivityRows.value.map((row) => (dimension.value === 'day' ? formatDateLabel(row.date) : row.shiftName)),
)

const productivityDatasets = computed(() => [
  {
    label: 'Output OK',
    data: productivityRows.value.map((row) => row.okQty),
    backgroundColor: '#10b981',
    stack: 'output',
    borderRadius: 3,
  },
  {
    label: 'Output NG',
    data: productivityRows.value.map((row) => row.ngQty + row.rejectQty),
    backgroundColor: '#ef4444',
    stack: 'output',
    borderRadius: 3,
  },
  {
    type: 'line',
    label: 'OEE (%)',
    data: productivityRows.value.map((row) => row.oee?.oee ?? null),
    yAxisID: 'y1',
    borderColor: '#e91e63',
    backgroundColor: '#e91e63',
    tension: 0.35,
    spanGaps: true,
  },
])

const productivityOptions = computed(() => ({
  scales: {
    x: { stacked: true },
    y: {
      stacked: true,
      title: { display: true, text: 'Unit', color: '#94a3b8', font: { size: 10 } },
    },
    y1: {
      position: 'right',
      min: 0,
      max: 100,
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'OEE %', color: '#94a3b8', font: { size: 10 } },
    },
  },
}))

const paretoLabels = computed(() => store.defectPareto.map((defect) => defect.defectCode))

const paretoDatasets = computed(() => [
  {
    label: 'Jumlah NG',
    data: store.defectPareto.map((defect) => defect.qty),
    backgroundColor: store.defectPareto.map((defect) => (defect.isVitalFew ? '#ef4444' : '#00b0ff')),
    borderRadius: 3,
  },
  {
    type: 'line',
    label: 'Kumulatif (%)',
    data: store.defectPareto.map((defect) => defect.cumulativePercentage),
    yAxisID: 'y1',
    borderColor: '#f59e0b',
    backgroundColor: '#f59e0b',
    tension: 0.2,
  },
])

const paretoOptions = computed(() => ({
  scales: {
    x: { stacked: false },
    y: { beginAtZero: true, ticks: { precision: 0 } },
    y1: {
      position: 'right',
      min: 0,
      max: 100,
      grid: { drawOnChartArea: false },
      ticks: { callback: (value) => `${value}%` },
    },
  },
}))

async function loadSummary() {
  try {
    await store.fetchSummary()
    lastUpdated.value = new Date().toLocaleTimeString('id-ID', { hour12: false })
  } catch {
    /* pesan error sudah tersimpan di store */
  }
}

function openDrillDown(drillConfig) {
  drill.value = drillConfig
  drillOpen.value = true
  store.fetchRawLogs(drillConfig.params, 1).catch(() => {})
}

function openDefect(defect) {
  openDrillDown({
    title: `Log defect ${defect.defectCode}`,
    description: `${defect.defectName} - ${defect.qty} unit (${defect.percentage}% dari total defect, kumulatif ${defect.cumulativePercentage}%).`,
    params: { defectCode: defect.defectCode },
  })
}

function openDowntime(row) {
  openDrillDown({
    title: `Downtime ${row.category}`,
    description: `${row.minutes} menit dari ${row.events} kejadian (${row.percentage}% dari total downtime).`,
    params: { downtimeCategory: row.category, hasDowntime: true },
  })
}

function handleProductivityClick(payload) {
  const [element] = payload
  if (!element) return
  const row = productivityRows.value[element.index]
  if (!row) return

  if (dimension.value === 'day') {
    openDrillDown({
      title: `Log produksi ${formatDateLabel(row.date)}`,
      description: `${row.logCount} log - OK ${formatNumber(row.okQty)}, NG ${formatNumber(row.ngQty + row.rejectQty)}, downtime ${formatNumber(row.downtimeMinutes)} menit.`,
      params: { date: row.date, from: undefined, to: undefined },
    })
    return
  }

  openDrillDown({
    title: `Log produksi ${row.shiftName}`,
    description: `${row.shiftCode} (${row.startTime} - ${row.endTime}) - ${row.logCount} log, OEE ${formatPercent(row.oee?.oee)}.`,
    params: { shiftId: row.shiftId, from: undefined, to: undefined },
  })
}

function handleParetoClick(payload) {
  const [element] = payload
  if (!element) return
  const defect = store.defectPareto[element.index]
  if (defect) openDefect(defect)
}

function handlePageChange(page) {
  store.fetchRawLogs(drill.value.params, page).catch(() => {})
}

async function handleLimitChange(limit) {
  store.setLimit(limit)
  try {
    await store.fetchRawLogs(drill.value.params, 1)
  } catch {
    /* pesan error sudah tersimpan di store */
  }
}

function handleReset() {
  store.resetFilters()
  loadSummary()
}

onMounted(async () => {
  loadSummary()
  try {
    const [s, m, i] = await Promise.all([api.get('/shifts'), api.get('/machines'), api.get('/items')])
    shifts.value = s.data
    machines.value = m.data
    items.value = i.data
  } catch {
    shifts.value = []
    machines.value = []
    items.value = []
  }
})
</script>
