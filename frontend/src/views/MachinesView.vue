<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Mesin</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Kelola data mesin produksi</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition"
        @click="openCreate"
      >
        + Tambah Mesin
      </button>
    </div>

    <p
      v-if="machineStore.error && !modalOpen"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ machineStore.error }}
    </p>

    <DataTable
      :columns="columns"
      :items="machineStore.items"
      :loading="machineStore.loading"
      @edit="openEdit"
      @delete="handleDelete"
    >
      <template #cell-isActive="{ value }">
        <BadgeStatus :value="value" :label="value ? 'Aktif' : 'Nonaktif'" />
      </template>
    </DataTable>

    <ModalForm
      v-model="modalOpen"
      :title="editingId ? 'Edit Mesin' : 'Tambah Mesin'"
      :submit-label="editingId ? 'Simpan Perubahan' : 'Simpan'"
      :loading="machineStore.saving"
      :error="formError"
      @submit="handleSubmit"
    >
      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Kode <span class="text-red-500">*</span></label>
        <input
          v-model="form.code"
          type="text"
          placeholder="mis. CNC-001"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Nama Mesin <span class="text-red-500">*</span></label>
        <input
          v-model="form.name"
          type="text"
          placeholder="mis. CNC Milling"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Lokasi</label>
        <input
          v-model="form.location"
          type="text"
          placeholder="mis. Lantai Produksi A"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="flex items-center gap-2 text-sm font-medium text-gray-600">
          <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded border-gray-300 focus:ring-[#e91e63]" />
          Mesin aktif
        </label>
      </div>
    </ModalForm>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import DataTable from '@/components/DataTable.vue'
import ModalForm from '@/components/ModalForm.vue'
import BadgeStatus from '@/components/BadgeStatus.vue'
import { useMachineStore } from '@/stores/masterdata'

const machineStore = useMachineStore()

const columns = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama Mesin' },
  { key: 'location', label: 'Lokasi' },
  { key: 'isActive', label: 'Status' },
]

const modalOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({ code: '', name: '', location: '', isActive: true })

function resetForm() {
  editingId.value = null
  formError.value = ''
  form.code = ''
  form.name = ''
  form.location = ''
  form.isActive = true
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formError.value = ''
  form.code = row.code
  form.name = row.name
  form.location = row.location ?? ''
  form.isActive = row.isActive
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.code || !form.name) {
    formError.value = 'Kode dan nama mesin wajib diisi'
    return
  }

  const payload = {
    code: form.code,
    name: form.name,
    location: form.location || undefined,
    isActive: form.isActive,
  }

  try {
    if (editingId.value) {
      await machineStore.update(editingId.value, payload)
    } else {
      await machineStore.create(payload)
    }
    modalOpen.value = false
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Gagal menyimpan mesin'
  }
}

async function handleDelete(row) {
  if (!window.confirm(`Hapus mesin "${row.name}"?`)) return
  try {
    await machineStore.remove(row.id)
  } catch (err) {
    window.alert(err?.response?.data?.message || 'Gagal menghapus mesin')
  }
}

onMounted(() => machineStore.fetchAll())
</script>