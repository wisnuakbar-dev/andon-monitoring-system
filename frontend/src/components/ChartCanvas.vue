<template>
  <div class="relative" :style="{ height }">
    <canvas ref="canvasEl"></canvas>
    <p
      v-if="!hasData"
      class="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
    >
      {{ emptyText }}
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  ArcElement,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { useThemeStore } from '@/stores/theme'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  ArcElement,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const props = defineProps({
  type: { type: String, default: 'bar' },
  labels: { type: Array, default: () => [] },
  datasets: { type: Array, default: () => [] },
  options: { type: Object, default: () => ({}) },
  height: { type: String, default: '280px' },
  emptyText: { type: String, default: 'Belum ada data pada rentang ini.' },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const theme = useThemeStore()
const canvasEl = ref(null)
let chart = null

const hasData = computed(() =>
  props.datasets.some((dataset) => (dataset.data ?? []).some((value) => Number(value) > 0)),
)

const palette = () => ({
  grid: theme.dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
  text: theme.dark ? '#94a3b8' : '#64748b',
})

const baseOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: true },
  onClick: props.clickable
    ? (event, elements) => {
        if (!elements.length) return
        emit('select', elements.map((element) => ({
          index: element.index,
          datasetIndex: element.datasetIndex,
          label: props.labels[element.index] ?? null,
          value: props.datasets[element.datasetIndex]?.data?.[element.index] ?? null,
        })))
      }
    : undefined,
  onHover: props.clickable
    ? (event, elements) => {
        if (canvasEl.value) canvasEl.value.style.cursor = elements.length ? 'pointer' : 'default'
      }
    : undefined,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: { color: palette().text, boxWidth: 12, font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: theme.dark ? '#0f172a' : '#111827',
      padding: 10,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
    },
  },
  scales:
    props.type === 'doughnut'
      ? undefined
      : {
          x: {
            grid: { display: false },
            ticks: { color: palette().text, font: { size: 11 }, maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            grid: { color: palette().grid },
            ticks: { color: palette().text, font: { size: 11 } },
          },
        },
})

const mergeScales = (base, extra) => {
  if (!extra) return base
  if (!base) return extra
  const keys = new Set([...Object.keys(base), ...Object.keys(extra)])
  return Object.fromEntries([...keys].map((key) => [key, { ...base[key], ...extra[key] }]))
}

function buildConfig() {
  const base = baseOptions()
  return {
    type: props.type,
    data: { labels: props.labels, datasets: props.datasets },
    options: {
      ...base,
      ...props.options,
      scales: mergeScales(base.scales, props.options.scales),
      plugins: { ...base.plugins, ...(props.options.plugins ?? {}) },
    },
  }
}

function render() {
  if (!canvasEl.value) return
  if (chart) {
    chart.destroy()
    chart = null
  }
  chart = new Chart(canvasEl.value, buildConfig())
}

watch(
  () => [props.labels, props.datasets, props.options, theme.dark],
  () => render(),
  { deep: true },
)

onMounted(render)
onBeforeUnmount(() => {
  if (chart) {
    chart.destroy()
    chart = null
  }
})
</script>
