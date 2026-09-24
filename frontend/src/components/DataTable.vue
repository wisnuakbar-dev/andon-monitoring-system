<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-slate-700">
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap"
            >
              {{ column.label }}
            </th>
            <th
              v-if="showActions"
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-28"
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
          <tr v-if="loading">
            <td :colspan="colspan" class="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
              Memuat data...
            </td>
          </tr>
          <tr v-else-if="!items.length">
            <td :colspan="colspan" class="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
              Belum ada data.
            </td>
          </tr>
          <tr v-for="(row, index) in items" :key="row.id ?? index" class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td v-for="column in columns" :key="column.key" class="px-4 py-3 whitespace-nowrap">
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :value="row[column.key]"
                :column="column"
              >
                <BadgeStatus v-if="column.type === 'status'" :value="row[column.key]" />
                <span v-else>{{ formatValue(row[column.key], column) }}</span>
              </slot>
            </td>
            <td v-if="showActions" class="px-4 py-3 whitespace-nowrap">
              <slot name="actions" :row="row">
                <button
                  class="text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white font-semibold text-sm mr-3"
                  @click="$emit('edit', row)"
                >
                  Edit
                </button>
                <button
                  class="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold text-sm"
                  @click="$emit('delete', row)"
                >
                  Hapus
                </button>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>{{ rangeLabel }}</span>
      <span>© 2026 - All rights reserved. | Version: 0.0.58-5</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BadgeStatus from './BadgeStatus.vue'

const props = defineProps({
  columns: { type: Array, required: true },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showActions: { type: Boolean, default: true },
})

defineEmits(['edit', 'delete'])

const colspan = computed(() => props.columns.length + (props.showActions ? 1 : 0))

const rangeLabel = computed(() => {
  const total = props.items.length
  return total ? `1-${total} of ${total} items` : '0 of 0 items'
})

function formatValue(value, column) {
  if (value === null || value === undefined || value === '') return '-'
  if (column.type === 'boolean') return value ? 'Ya' : 'Tidak'
  if (column.type === 'date') return new Date(value).toLocaleString('id-ID')
  return String(value)
}
</script>