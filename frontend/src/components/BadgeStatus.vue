<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    :class="badgeClass"
  >
    {{ displayLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: [String, Boolean, Number], default: null },
  label: { type: String, default: '' },
})

const displayLabel = computed(() => {
  if (props.label) return props.label
  if (typeof props.value === 'boolean') return props.value ? 'Aktif' : 'Nonaktif'
  return String(props.value ?? '-')
})

const badgeClass = computed(() => {
  const raw = props.value
  let v
  if (typeof raw === 'boolean') v = raw ? 'ACTIVE' : 'INACTIVE'
  else v = String(raw ?? '').toUpperCase()

  if (['ACTIVE', 'APPROVED', 'AKTIF', 'TRUE', 'RUNNING', 'ONLINE', 'OPEN'].includes(v)) {
    return 'bg-[#00b0ff] text-white'
  }
  if (['DONE', 'SELESAI', 'COMPLETED', 'SUCCESS', 'OK', 'CLOSED', 'FINISHED'].includes(v)) {
    return 'bg-[#00c853] text-white'
  }
  if (['WARNING', 'ABNORMAL', 'PENDING', 'PLANNED', 'STOPPED'].includes(v)) {
    return 'bg-amber-500 text-white'
  }
  if (['INACTIVE', 'REJECTED', 'FALSE', 'NONAKTIF', 'ERROR', 'FAILED', 'CANCELLED'].includes(v)) {
    return 'bg-gray-800 text-white dark:bg-gray-950'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'
})
</script>