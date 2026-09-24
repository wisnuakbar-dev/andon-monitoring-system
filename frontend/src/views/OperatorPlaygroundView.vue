<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Operator Playground</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Simulator operator - setiap tombol mem-publish kejadian ke broker MQTT</p>
      </div>
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium" :class="statusClass">
        <span class="w-2.5 h-2.5 rounded-full" :class="statusDot"></span>
        {{ statusLabel }}
      </span>
    </div>

    <p
      v-if="mqtt.error"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ mqtt.error }}
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 lg:col-span-2">
        <h2 class="font-semibold dark:text-white mb-3">Koneksi Broker</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Broker URL</label>
            <input
              v-model="mqtt.url"
              type="text"
              placeholder="wss://test.mosquitto.org:8081/mqtt"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Topik Publish</label>
            <input
              v-model="mqtt.topic"
              type="text"
              placeholder="andon/simulator"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
            />
          </div>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <button
            v-if="!mqtt.isConnected"
            class="px-4 py-2 rounded-lg bg-[#e91e63] text-white text-sm font-bold hover:bg-pink-700 transition"
            :disabled="mqtt.isBusy"
            @click="mqtt.connect()"
          >
            {{ mqtt.isBusy ? 'Menghubungkan...' : 'Hubungkan' }}
          </button>
          <button
            v-else
            class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
            @click="mqtt.disconnect()"
          >
            Putuskan
          </button>
          <button
            class="px-3 py-2 rounded-lg bg-black text-white text-sm font-bold hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
            @click="mqtt.resetUrl()"
          >
            Reset default
          </button>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <h2 class="font-semibold dark:text-white mb-3">Work Order (Approved)</h2>
        <select
          v-model="selectedWoId"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        >
          <option value="" disabled>Pilih work order</option>
          <option v-for="wo in workOrders" :key="wo.id" :value="wo.id">
            {{ wo.code }} - {{ wo.machine?.name ?? 'Mesin ?' }} ({{ wo.item?.name ?? 'Item ?' }})
          </option>
        </select>

        <dl v-if="selectedWo" class="mt-3 space-y-1.5 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Mesin</dt>
            <dd class="font-medium text-right dark:text-gray-100">{{ selectedWo.machine?.name ?? '-' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Item</dt>
            <dd class="font-medium text-right dark:text-gray-100">{{ selectedWo.item?.name ?? '-' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Shift</dt>
            <dd class="font-medium text-right dark:text-gray-100">{{ selectedWo.shift?.name ?? '-' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Target</dt>
            <dd class="font-medium text-right dark:text-gray-100">{{ selectedWo.targetQuantity ?? '-' }}</dd>
          </div>
        </dl>
        <p v-else class="mt-3 text-sm text-gray-400 dark:text-gray-500">Tidak ada work order berstatus Approved.</p>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4">
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kuantitas (Shoot / NG)</label>
          <input
            v-model.number="qty"
            type="number"
            min="1"
            class="w-28 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Defect (untuk NG)</label>
          <select
            v-model="defectId"
            class="w-48 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="">Tanpa defect</option>
            <option v-for="d in defects" :key="d.id" :value="d.id">{{ d.name }} ({{ d.code }})</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Abnormality</label>
          <select
            v-model="abnormalityId"
            class="w-48 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="">Tanpa abnormality</option>
            <option v-for="a in abnormalities" :key="a.id" :value="a.id">{{ a.name }} ({{ a.code }})</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Downtime Menit (Break)</label>
          <input
            v-model.number="downMinutes"
            type="number"
            min="0"
            class="w-28 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <button
        v-for="btn in buttons"
        :key="btn.event"
        class="h-28 rounded-xl text-left p-5 text-white shadow transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        :class="btn.color"
        :disabled="disabled"
        @click="sendEvent(btn.event)"
      >
        <span class="block text-lg font-bold">{{ btn.label }}</span>
        <span class="block text-sm opacity-90 mt-1">{{ btn.desc }}</span>
      </button>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold dark:text-white">Log Publikasi ({{ mqtt.log.length }})</h2>
        <button
          v-if="mqtt.log.length"
          class="text-sm text-gray-500 hover:text-gray-700"
          @click="mqtt.log = []"
        >
          Bersihkan
        </button>
      </div>
      <p v-if="!mqtt.log.length" class="text-sm text-gray-400 dark:text-gray-500">
        Belum ada kejadian dipublish. Hubungkan broker lalu klik salah satu tombol di atas.
      </p>
      <ul v-else class="space-y-2 max-h-96 overflow-y-auto">
        <li
          v-for="item in mqtt.log"
          :key="item.id"
          class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700"
        >
          <span class="mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-black dark:bg-white text-white dark:text-black shrink-0">
            {{ item.label }}
          </span>
          <div class="min-w-0 flex-1">
            <code class="block text-xs text-gray-600 dark:text-gray-300 break-all font-mono">{{ item.payload || '(tanpa payload)' }}</code>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ formatTime(item.time) }}</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'
import { useMqttStore } from '@/stores/mqtt'
import { useAuthStore } from '@/stores/auth'

const mqtt = useMqttStore()
const auth = useAuthStore()

const workOrders = ref([])
const defects = ref([])
const abnormalities = ref([])
const selectedWoId = ref('')
const qty = ref(1)
const defectId = ref('')
const abnormalityId = ref('')
const downMinutes = ref(5)

const selectedWo = computed(() => workOrders.value.find((wo) => wo.id === selectedWoId.value) ?? null)

const disabled = computed(() => !mqtt.isConnected || !selectedWo.value)

const buttons = [
  { event: 'START_SHIFT', label: 'Start Shift', desc: 'Mulai shift kerja', color: 'bg-green-600 hover:bg-green-700' },
  { event: 'SHOOT', label: 'Shoot', desc: 'Output OK', color: 'bg-blue-600 hover:bg-blue-700' },
  { event: 'INPUT_NG', label: 'Input NG', desc: 'Output cacat', color: 'bg-red-600 hover:bg-red-700' },
  { event: 'ABNORMALITY', label: 'Input Abnormality', desc: 'Tandai mesin abnormal', color: 'bg-amber-500 hover:bg-amber-600' },
  { event: 'BREAK', label: 'Break', desc: 'Mesin berhenti / downtime', color: 'bg-indigo-600 hover:bg-indigo-700' },
  { event: 'PRODUCTION_SETUP', label: 'Production Setup', desc: 'Setup produksi dimulai', color: 'bg-violet-600 hover:bg-violet-700' },
  { event: 'FINISH_SHIFT', label: 'Finish Shift', desc: 'Akhiri shift kerja', color: 'bg-gray-800 hover:bg-gray-900' },
]

const statusMap = {
  connected: { label: 'Terhubung', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  connecting: { label: 'Menghubungkan...', cls: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  error: { label: 'Gagal terhubung', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  disconnected: { label: 'Terputus', cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
}

const statusClass = computed(() => statusMap[mqtt.status]?.cls ?? statusMap.disconnected.cls)
const statusDot = computed(() => statusMap[mqtt.status]?.dot ?? statusMap.disconnected.dot)
const statusLabel = computed(() => statusMap[mqtt.status]?.label ?? statusMap.disconnected.label)

function context() {
  const wo = selectedWo.value
  return {
    workOrderId: wo?.id,
    workOrderCode: wo?.code,
    workOrderType: wo?.type,
    workOrderApprovalStatus: wo?.approvalStatus,
    machineId: wo?.machine?.id,
    machineCode: wo?.machine?.code,
    machineName: wo?.machine?.name,
    machineLocation: wo?.machine?.location,
    itemId: wo?.item?.id,
    itemCode: wo?.item?.code,
    itemName: wo?.item?.name,
    shiftId: wo?.shift?.id,
    shiftName: wo?.shift?.name,
    shiftStartTime: wo?.shift?.startTime,
    shiftEndTime: wo?.shift?.endTime,
    targetQuantity: wo?.targetQuantity,
    operatorId: auth.user?.id,
    operatorName: auth.user?.name,
    operatorUsername: auth.user?.username,
    timestamp: new Date().toISOString(),
  }
}

function buildExtra(event) {
  if (event === 'SHOOT') {
    return { result: 'OK', goodQty: Math.max(1, qty.value || 1) }
  }
  if (event === 'INPUT_NG') {
    const defect = defects.value.find((d) => d.id === defectId.value)
    return {
      result: 'NG',
      ngQty: Math.max(1, qty.value || 1),
      defectId: defect?.id,
      defectCode: defect?.code,
      defectName: defect?.name,
    }
  }
  if (event === 'ABNORMALITY') {
    const abnormality = abnormalities.value.find((a) => a.id === abnormalityId.value)
    return {
      abnormalityId: abnormality?.id,
      abnormalityCode: abnormality?.code,
      abnormalityName: abnormality?.name,
    }
  }
  if (event === 'BREAK') {
    return { downtimeMinutes: Math.max(0, downMinutes.value || 0) }
  }
  if (event === 'START_SHIFT') {
    return { eventStatus: 'STARTED' }
  }
  if (event === 'FINISH_SHIFT') {
    return { eventStatus: 'FINISHED' }
  }
  return {}
}

async function sendEvent(event) {
  const extra = buildExtra(event)
  try {
    await mqtt.publish(event, { ...context(), ...extra })
  } catch (err) {
    window.alert(err?.message || 'Gagal publish ke broker MQTT')
  }
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour12: false })

onMounted(async () => {
  try {
    const { data } = await api.get('/work-orders', { params: { approvalStatus: 'APPROVED' } })
    workOrders.value = data
    if (data.length) selectedWoId.value = data[0].id
  } catch {
    workOrders.value = []
  }

  try {
    const { data } = await api.get('/defects')
    defects.value = data
  } catch {
    defects.value = []
  }

  try {
    const { data } = await api.get('/abnormalities')
    abnormalities.value = data
  } catch {
    abnormalities.value = []
  }
})
</script>