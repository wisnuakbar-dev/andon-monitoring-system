<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="close"></div>

        <div
          class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        >
          <div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div class="min-w-0">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white truncate">{{ title }}</h3>
              <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {{ description }}
              </p>
            </div>
            <button
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0"
              @click="close"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-gray-50 dark:bg-slate-900">
                <tr class="border-b border-gray-200 dark:border-slate-700">
                  <th
                    v-for="column in columns"
                    :key="column.key"
                    class="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap"
                    :class="column.align === 'right' ? 'text-right' : ''"
                  >
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
                <tr v-if="loading">
                  <td :colspan="columns.length" class="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                    Memuat data mentah...
                  </td>
                </tr>
                <tr v-else-if="!logs.length">
                  <td :colspan="columns.length" class="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                    Tidak ada log yang membentuk angka ini.
                  </td>
                </tr>
                <tr
                  v-for="log in logs"
                  :key="log.id"
                  class="hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <td
                    v-for="column in columns"
                    :key="column.key"
                    class="px-3 py-2.5 whitespace-nowrap"
                    :class="column.align === 'right' ? 'text-right tabular-nums' : ''"
                  >
                    <BadgeStatus v-if="column.key === 'result'" :value="log.result" />
                    <span
                      v-else-if="column.key === 'downtimeCategory' && log.downtimeCategory"
                      class="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    >
                      {{ log.downtimeCategory }}
                    </span>
                    <slot v-else :name="`cell-${column.key}`" :row="log" :value="log[column.key]">
                      {{ format(log, column) }}
                    </slot>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="error"
            class="px-6 py-3 bg-red-50 dark:bg-red-900/40 border-t border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
          >
            {{ error }}
          </div>

          <div
            class="px-6 py-3 border-t border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"
          >
            <span>
              Menampilkan <strong class="text-gray-900 dark:text-white">{{ rangeStart }}-{{ rangeEnd }}</strong>
              dari <strong class="text-gray-900 dark:text-white">{{ total }}</strong> log mentah
            </span>
            <div class="flex items-center gap-3">
              <select
                :value="limit"
                class="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none"
                @change="$emit('limit-change', Number($event.target.value))"
              >
                <option :value="25">25 / halaman</option>
                <option :value="50">50 / halaman</option>
                <option :value="100">100 / halaman</option>
              </select>
              <div class="flex items-center gap-1">
                <button
                  class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="page <= 1"
                  @click="$emit('page-change', page - 1)"
                >
                  Sebelumnya
                </button>
                <span class="px-2 text-xs tabular-nums">{{ page }} / {{ totalPages }}</span>
                <button
                  class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="page >= totalPages"
                  @click="$emit('page-change', page + 1)"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import BadgeStatus from './BadgeStatus.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Detail Log' },
  description: { type: String, default: '' },
  logs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  limit: { type: Number, default: 25 },
  timezone: { type: String, default: 'Asia/Jakarta' },
})

const emit = defineEmits(['update:modelValue', 'page-change', 'limit-change'])

const columns = [
  { key: 'loggedAt', label: 'Waktu' },
  { key: 'workOrder', label: 'Work Order' },
  { key: 'machine', label: 'Mesin' },
  { key: 'shift', label: 'Shift' },
  { key: 'result', label: 'Hasil' },
  { key: 'goodQty', label: 'OK', align: 'right' },
  { key: 'ngQty', label: 'NG', align: 'right' },
  { key: 'cycleTimeSeconds', label: 'Cycle (s)', align: 'right' },
  { key: 'downtimeMinutes', label: 'Downtime (mnt)', align: 'right' },
  { key: 'downtimeCategory', label: 'Kategori' },
  { key: 'note', label: 'Catatan' },
]

const rangeStart = computed(() => (props.total ? (props.page - 1) * props.limit + 1 : 0))
const rangeEnd = computed(() => Math.min(props.page * props.limit, props.total))

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: props.timezone,
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function format(log, column) {
  if (column.key === 'loggedAt') return formatDateTime(log.loggedAt)
  if (column.key === 'workOrder') return log.workOrder?.code ?? '-'
  if (column.key === 'machine') return log.workOrder?.machine?.name ?? '-'
  if (column.key === 'shift') return log.workOrder?.shift?.name ?? '-'

  const value = log[column.key]
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function close() {
  emit('update:modelValue', false)
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.modal-fade-enter-active > div:last-child {
  transform-origin: center;
}
</style>
