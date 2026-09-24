import { defineStore } from 'pinia'
import api from '@/services/api'

function createResourceStore(id, resource) {
  return defineStore(id, {
    state: () => ({
      items: [],
      loading: false,
      saving: false,
      error: null,
    }),
    actions: {
      async fetchAll() {
        this.loading = true
        this.error = null
        try {
          const { data } = await api.get(`/${resource}`)
          this.items = data
        } catch (err) {
          this.error = err?.response?.data?.message || 'Gagal memuat data'
          throw err
        } finally {
          this.loading = false
        }
      },
      async create(payload) {
        this.saving = true
        this.error = null
        try {
          const { data } = await api.post(`/${resource}`, payload)
          this.items.unshift(data)
          return data
        } catch (err) {
          this.error = err?.response?.data?.message || 'Gagal menyimpan data'
          throw err
        } finally {
          this.saving = false
        }
      },
      async update(id, payload) {
        this.saving = true
        this.error = null
        try {
          const { data } = await api.put(`/${resource}/${id}`, payload)
          const index = this.items.findIndex((item) => item.id === id)
          if (index !== -1) {
            this.items[index] = { ...this.items[index], ...data }
          }
          return data
        } catch (err) {
          this.error = err?.response?.data?.message || 'Gagal memperbarui data'
          throw err
        } finally {
          this.saving = false
        }
      },
      async remove(id) {
        this.error = null
        try {
          await api.delete(`/${resource}/${id}`)
          this.items = this.items.filter((item) => item.id !== id)
        } catch (err) {
          this.error = err?.response?.data?.message || 'Gagal menghapus data'
          throw err
        }
      },
    },
  })
}

export const useUserStore = createResourceStore('users', 'users')
export const useMachineStore = createResourceStore('machines', 'machines')
export const useItemStore = createResourceStore('items', 'items')
export const useWorkOrderStore = createResourceStore('workOrders', 'work-orders')