<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Manajemen User</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Kelola akun pengguna sistem</p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 transition"
        @click="openCreate"
      >
        + Tambah User
      </button>
    </div>

    <p
      v-if="userStore.error && !modalOpen"
      class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
    >
      {{ userStore.error }}
    </p>

    <DataTable
      :columns="columns"
      :items="userStore.items"
      :loading="userStore.loading"
      @edit="openEdit"
      @delete="handleDelete"
    >
      <template #cell-role="{ value }">
        <BadgeStatus :value="roleBadgeValue(value?.code)" :label="value?.name ?? '-'" />
      </template>
    </DataTable>

    <ModalForm
      v-model="modalOpen"
      :title="editingId ? 'Edit User' : 'Tambah User'"
      :submit-label="editingId ? 'Simpan Perubahan' : 'Simpan'"
      :loading="userStore.saving"
      :error="formError"
      @submit="handleSubmit"
    >
      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Username <span class="text-red-500">*</span></label>
        <input
          v-model="form.username"
          type="text"
          placeholder="mis. johndoe"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Nama Lengkap <span class="text-red-500">*</span></label>
        <input
          v-model="form.name"
          type="text"
          placeholder="mis. John Doe"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Email</label>
        <input
          v-model="form.email"
          type="email"
          placeholder="mis. john@company.com"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">Role <span class="text-red-500">*</span></label>
        <select
          v-model="form.roleId"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63] bg-white"
        >
          <option value="" disabled>Pilih role</option>
          <option v-for="role in roles" :key="role.id" :value="role.id">
            {{ role.name }} ({{ role.code }})
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-600 mb-1">
          Password <span v-if="!editingId" class="text-red-500">*</span>
          <span v-else class="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>
        </label>
        <input
          v-model="form.password"
          type="password"
          placeholder="Kata sandi"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        />
      </div>
    </ModalForm>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import DataTable from '@/components/DataTable.vue'
import ModalForm from '@/components/ModalForm.vue'
import BadgeStatus from '@/components/BadgeStatus.vue'
import { useUserStore } from '@/stores/masterdata'
import api from '@/services/api'

const userStore = useUserStore()

const columns = [
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'createdAt', label: 'Dibuat', type: 'date' },
]

const roles = ref([])
const modalOpen = ref(false)
const editingId = ref(null)
const formError = ref('')
const form = reactive({ username: '', name: '', email: '', roleId: '', password: '' })

const roleBadgeValue = (code) => {
  if (code === 'ADMIN') return 'INACTIVE'
  if (code === 'SUPERVISOR') return 'ACTIVE'
  return 'OTHER'
}

function resetForm() {
  editingId.value = null
  formError.value = ''
  form.username = ''
  form.name = ''
  form.email = ''
  form.roleId = ''
  form.password = ''
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formError.value = ''
  form.username = row.username
  form.name = row.name
  form.email = row.email ?? ''
  form.roleId = row.roleId
  form.password = ''
  modalOpen.value = true
}

function validate() {
  if (!form.username || !form.name || !form.roleId) return 'Username, nama, dan role wajib diisi'
  if (!editingId.value && !form.password) return 'Password wajib diisi untuk user baru'
  return ''
}

async function handleSubmit() {
  const invalid = validate()
  if (invalid) {
    formError.value = invalid
    return
  }

  const payload = {
    username: form.username,
    name: form.name,
    email: form.email || undefined,
    roleId: form.roleId,
  }
  if (form.password) payload.password = form.password

  try {
    if (editingId.value) {
      await userStore.update(editingId.value, payload)
    } else {
      await userStore.create(payload)
    }
    modalOpen.value = false
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Gagal menyimpan user'
  }
}

async function handleDelete(row) {
  if (!window.confirm(`Hapus user "${row.username}"?`)) return
  try {
    await userStore.remove(row.id)
  } catch (err) {
    window.alert(err?.response?.data?.message || 'Gagal menghapus user')
  }
}

onMounted(async () => {
  userStore.fetchAll()
  try {
    const { data } = await api.get('/roles')
    roles.value = data
  } catch {
    roles.value = []
  }
})
</script>