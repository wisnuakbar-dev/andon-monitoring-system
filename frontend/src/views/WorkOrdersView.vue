<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Work Order Management</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Rencana produksi harian / bulanan</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition"
        @click="openCreate"
      >
        + Rencana Baru
      </button>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-4 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipe</label>
        <select
          v-model="filter.type"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadWorkOrders"
        >
          <option value="">Semua Tipe</option>
          <option value="HARIAN">Harian</option>
          <option value="BULANAN">Bulanan</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status Persetujuan</label>
        <select
          v-model="filter.approvalStatus"
          class="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          @change="loadWorkOrders"
        >
          <option value="">Semua Status</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      <button
        class="px-3 py-2 rounded-lg bg-black text-white font-bold text-sm hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
        @click="resetFilterAndReload"
      >
        Reset
      </button>
    </div>

    <p
      v-if="workOrderStore.error && !modalOpen"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ workOrderStore.error }}
    </p>

    <DataTable
      :columns="columns"
      :items="workOrderStore.items"
      :loading="workOrderStore.loading"
      @edit="openEdit"
      @delete="handleDelete"
    >
      <template #cell-type="{ value }">
        <span
          class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="value === 'BULANAN' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'"
        >
          {{ value === 'BULANAN' ? 'Bulanan' : 'Harian' }}
        </span>
      </template>

      <template #cell-item="{ value }">{{ value?.name ?? '-' }}</template>
      <template #cell-machine="{ value }">{{ value?.name ?? '-' }}</template>
      <template #cell-shift="{ value }">{{ value?.name ?? '-' }}</template>

      <template #cell-approvalStatus="{ value }">
        <BadgeStatus :value="value" />
      </template>

      <template #actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            v-if="row.approvalStatus === 'DRAFT'"
            class="text-green-600 hover:text-green-800 font-medium text-sm"
            @click="handleApproveReject(row, 'APPROVED')"
          >
            Approve
          </button>
          <button
            v-if="row.approvalStatus === 'DRAFT' || row.approvalStatus === 'APPROVED'"
            class="text-red-600 hover:text-red-800 font-medium text-sm"
            @click="handleApproveReject(row, 'REJECTED')"
          >
            Reject
          </button>
          <button
            v-if="row.approvalStatus === 'REJECTED'"
            class="text-green-600 hover:text-green-800 font-medium text-sm"
            @click="handleApproveReject(row, 'APPROVED')"
          >
            Approve
          </button>
          <button class="text-blue-600 hover:text-blue-800 font-medium text-sm" @click="openEdit(row)">
            Edit
          </button>
          <button class="text-gray-500 hover:text-gray-700 font-medium text-sm" @click="handleDelete(row)">
            Hapus
          </button>
        </div>
      </template>
    </DataTable>

    <ModalForm
      v-model="modalOpen"
      :title="editingId ? 'Edit Rencana' : 'Rencana Produksi Baru'"
      :submit-label="editingId ? 'Simpan Perubahan' : 'Simpan'"
      :loading="workOrderStore.saving"
      :error="formError"
      @submit="handleSubmit"
    >
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Kode WO <span class="text-red-500">*</span></label>
          <input
            v-model="form.code"
            type="text"
            placeholder="mis. WO-2026-001"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Tipe <span class="text-red-500">*</span></label>
          <select
            v-model="form.type"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="HARIAN">Harian</option>
            <option value="BULANAN">Bulanan</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Mesin <span class="text-red-500">*</span></label>
          <select
            v-model="form.machineId"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="" disabled>Pilih mesin</option>
            <option v-for="m in machines" :key="m.id" :value="m.id">{{ m.code }} - {{ m.name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Item <span class="text-red-500">*</span></label>
          <select
            v-model="form.itemId"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="" disabled>Pilih item</option>
            <option v-for="i in items" :key="i.id" :value="i.id">{{ i.code }} - {{ i.name }}</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Shift <span class="text-red-500">*</span></label>
          <select
            v-model="form.shiftId"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          >
            <option value="" disabled>Pilih shift</option>
            <option v-for="s in shifts" :key="s.id" :value="s.id">{{ s.name }} ({{ s.startTime }}-{{ s.endTime }})</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Target Qty</label>
          <input
            v-model.number="form.targetQuantity"
            type="number"
            min="0"
            placeholder="mis. 500"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Tanggal Mulai</label>
          <input
            v-model="form.scheduledDate"
            type="date"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Batas Waktu</label>
          <input
            v-model="form.dueDate"
            type="date"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Deskripsi</label>
        <textarea
          v-model="form.description"
          rows="2"
          placeholder="Catatan rencana (opsional)"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        ></textarea>
      </div>
    </ModalForm>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import DataTable from '@/components/DataTable.vue'
import ModalForm from '@/components/ModalForm.vue'
import BadgeStatus from '@/components/BadgeStatus.vue'
import { useWorkOrderStore } from '@/stores/masterdata'
import api from '@/services/api'

const workOrderStore = useWorkOrderStore()

const columns = [
  { key: 'code', label: 'Kode WO' },
  { key: 'type', label: 'Tipe' },
  { key: 'item', label: 'Item' },
  { key: 'machine', label: 'Mesin' },
  { key: 'shift', label: 'Shift' },
  { key: 'scheduledDate', label: 'Mulai', type: 'date' },
  { key: 'targetQuantity', label: 'Target' },
  { key: 'approvalStatus', label: 'Status' },
]

const filter = reactive({ type: '', approvalStatus: '' })
const machines = ref([])
const items = ref([])
const shifts = ref([])
const modalOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({
  code: '',
  type: 'HARIAN',
  machineId: '',
  itemId: '',
  shiftId: '',
  targetQuantity: null,
  scheduledDate: '',
  dueDate: '',
  description: '',
})

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '')

function resetForm() {
  editingId.value = null
  formError.value = ''
  form.code = ''
  form.type = 'HARIAN'
  form.machineId = ''
  form.itemId = ''
  form.shiftId = ''
  form.targetQuantity = null
  form.scheduledDate = ''
  form.dueDate = ''
  form.description = ''
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formError.value = ''
  form.code = row.code
  form.type = row.type
  form.machineId = row.machineId
  form.itemId = row.itemId
  form.shiftId = row.shiftId
  form.targetQuantity = row.targetQuantity
  form.scheduledDate = toDateInput(row.scheduledDate)
  form.dueDate = toDateInput(row.dueDate)
  form.description = row.description ?? ''
  modalOpen.value = true
}

function buildQueryString() {
  const params = new URLSearchParams()
  if (filter.type) params.set('type', filter.type)
  if (filter.approvalStatus) params.set('approvalStatus', filter.approvalStatus)
  return params.toString()
}

async function loadWorkOrders() {
  try {
    const query = buildQueryString()
    const { data } = await api.get(`/work-orders${query ? `?${query}` : ''}`)
    workOrderStore.items = data
  } catch (err) {
    workOrderStore.error = err?.response?.data?.message || 'Gagal memuat work order'
  }
}

function resetFilterAndReload() {
  filter.type = ''
  filter.approvalStatus = ''
  loadWorkOrders()
}

async function handleSubmit() {
  if (!form.code || !form.machineId || !form.itemId || !form.shiftId) {
    formError.value = 'Kode, mesin, item, dan shift wajib diisi'
    return
  }

  const payload = {
    code: form.code,
    type: form.type,
    machineId: form.machineId,
    itemId: form.itemId,
    shiftId: form.shiftId,
    targetQuantity: form.targetQuantity || undefined,
    scheduledDate: form.scheduledDate || undefined,
    dueDate: form.dueDate || undefined,
    description: form.description || undefined,
  }

  try {
    if (editingId.value) {
      await workOrderStore.update(editingId.value, payload)
    } else {
      await workOrderStore.create(payload)
    }
    modalOpen.value = false
    await loadWorkOrders()
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Gagal menyimpan work order'
  }
}

async function handleApproveReject(row, status) {
  const label = status === 'APPROVED' ? 'Approve' : 'Reject'
  if (!window.confirm(`${label} work order "${row.code}"?`)) return
  try {
    await workOrderStore.update(row.id, { approvalStatus: status })
    await loadWorkOrders()
  } catch (err) {
    window.alert(err?.response?.data?.message || `Gagal ${label.toLowerCase()} work order`)
  }
}

async function handleDelete(row) {
  if (!window.confirm(`Hapus work order "${row.code}"?`)) return
  try {
    await workOrderStore.remove(row.id)
    await loadWorkOrders()
  } catch (err) {
    window.alert(err?.response?.data?.message || 'Gagal menghapus work order')
  }
}

onMounted(async () => {
  loadWorkOrders()
  try {
    const [m, i, s] = await Promise.all([
      api.get('/machines'),
      api.get('/items'),
      api.get('/shifts'),
    ])
    machines.value = m.data
    items.value = i.data
    shifts.value = s.data
  } catch {
    machines.value = []
    items.value = []
    shifts.value = []
  }
})
</script>