<template>
  <div
    class="rounded-xl border px-4 py-3 flex flex-col justify-between"
    :class="toneClass"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="text-[0.7rem] uppercase tracking-[0.18em] text-white/60 font-semibold">
        {{ label }}
      </p>
      <span class="text-[0.65rem] uppercase tracking-wider text-white/50">{{ hint }}</span>
    </div>

    <p class="text-4xl xl:text-5xl font-black tabular-nums leading-none mt-2">
      {{ value }}<span v-if="unit" class="text-lg font-bold text-white/70 ml-1">{{ unit }}</span>
    </p>

    <div v-if="progress !== null" class="mt-3 h-2.5 rounded-full bg-white/15 overflow-hidden">
      <div
        class="h-full rounded-full transition-[width] duration-700"
        :class="progressBarClass"
        :style="{ width: `${Math.min(progress, 100)}%` }"
      ></div>
    </div>

    <p v-if="sub" class="mt-2 text-xs text-white/70 truncate">{{ sub }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '-' },
  unit: { type: String, default: '' },
  sub: { type: String, default: '' },
  hint: { type: String, default: '' },
  progress: { type: Number, default: null },
  tone: {
    type: String,
    default: 'neutral',
    validator: (value) => ['good', 'warn', 'bad', 'neutral'].includes(value),
  },
})

const toneClass = computed(
  () =>
    ({
      good: 'bg-emerald-950/70 border-emerald-500/60',
      warn: 'bg-amber-950/70 border-amber-500/60',
      bad: 'bg-red-950/80 border-red-500/70',
      neutral: 'bg-slate-900/80 border-slate-600/60',
    })[props.tone],
)

const progressBarClass = computed(
  () =>
    ({
      good: 'bg-emerald-400',
      warn: 'bg-amber-400',
      bad: 'bg-red-500',
      neutral: 'bg-sky-400',
    })[props.tone],
)
</script>
