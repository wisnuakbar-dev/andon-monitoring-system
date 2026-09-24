<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Item</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Kelola master produk / item produksi</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition"
        @click="openCreate"
      >
        + Tambah Item
      </button>
    </div>

    <p
      v-if="itemStore.error && !modalOpen"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ itemStore.error }}
    </p>

    <DataTable
      :columns="columns"
      :items="itemStore.items"
      :loading="itemStore.loading"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <ModalForm
      v-model="modalOpen"
      :title="editingId ? 'Edit Item' : 'Tambah Item'"
      :submit-label="editingId ? 'Simpan Perubahan' : 'Simpan'"
      :loading="itemStore.saving"
      :error="formError"
      @submit="handleSubmit"
    >
      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Kode <span class="text-red-500">*</span></label>
        <input
          v-model="form.code"
          type="text"
          placeholder="mis. ITM-001"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Nama Item <span class="text-red-500">*</span></label>
        <input
          v-model="form.name"
          type="text"
          placeholder="mis. Shaft Bearing"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Deskripsi</label>
        <textarea
          v-model="form.description"
          rows="3"
          placeholder="Deskripsi item (opsional)"
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
import { useItemStore } from '@/stores/masterdata'

const itemStore = useItemStore()

const columns = [
  { key: 'code', label: 'Kode' },
  { key: 'name', label: 'Nama Item' },
  { key: 'description', label: 'Deskripsi' },
]

const modalOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({ code: '', name: '', description: '' })

function resetForm() {
  editingId.value = null
  formError.value = ''
  form.code = ''
  form.name = ''
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
  form.name = row.name
  form.description = row.description ?? ''
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.code || !form.name) {
    formError.value = 'Kode dan nama item wajib diisi'
    return
  }

  const payload = {
    code: form.code,
    name: form.name,
    description: form.description || undefined,
  }

  try {
    if (editingId.value) {
      await itemStore.update(editingId.value, payload)
    } else {
      await itemStore.create(payload)
    }
    modalOpen.value = false
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Gagal menyimpan item'
  }
}

async function handleDelete(row) {
  if (!window.confirm(`Hapus item "${row.name}"?`)) return
  try {
    await itemStore.remove(row.id)
  } catch (err) {
    window.alert(err?.response?.data?.message || 'Gagal menghapus item')
  }
}

onMounted(() => itemStore.fetchAll())
</script>