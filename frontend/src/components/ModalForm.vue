<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="close"></div>

        <div class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ title }}</h3>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition" @click="close">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form
            class="flex-1 flex flex-col overflow-hidden"
            @submit.prevent="$emit('submit')"
          >
            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <slot />
            </div>

            <div
              v-if="error"
              class="px-6 py-3 bg-red-50 dark:bg-red-900/40 border-t border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
            >
              {{ error }}
            </div>

            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-end gap-2 rounded-b-xl">
              <slot name="footer">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-black text-white font-bold hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="loading"
                  @click="close"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="loading"
                >
                  {{ loading ? 'Menyimpan...' : submitLabel }}
                </button>
              </slot>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Form' },
  submitLabel: { type: String, default: 'Simpan' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'submit'])

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
  }
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