<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
    <div class="w-full max-w-md px-6">
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8">
        <div class="text-center mb-8">
          <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-black dark:bg-white flex items-center justify-center">
            <svg class="w-8 h-8 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v3m0 0v3m0-3h.01M3.34 17.5l6.83-11.83a2.5 2.5 0 014.66 0l6.83 11.83a2.5 2.5 0 01-2.16 3.75H5.5a2.5 2.5 0 01-2.16-3.75z" />
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-black dark:text-white">DCS APP</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Andon Monitoring System - Silakan masuk</p>
        </div>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              autocomplete="username"
              placeholder="Masukkan username"
              class="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e91e63] focus:border-transparent transition"
              :disabled="loading"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              placeholder="Masukkan password"
              class="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e91e63] focus:border-transparent transition"
              :disabled="loading"
            />
          </div>

          <div
            v-if="errorMessage"
            class="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-300"
          >
            {{ errorMessage }}
          </div>

          <button
            type="submit"
            class="w-full py-2.5 rounded-lg bg-[#e91e63] text-white font-bold hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e91e63] focus:ring-offset-white dark:focus:ring-offset-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>{{ loading ? 'Memproses...' : 'Masuk' }}</span>
          </button>
        </form>

        <p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Akun default: <span class="font-mono">admin / admin123</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''
  if (!form.username || !form.password) {
    errorMessage.value = 'Username dan password wajib diisi'
    return
  }

  loading.value = true
  try {
    await auth.login(form.username, form.password)
    router.push(route.query.redirect || '/')
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || 'Login gagal. Periksa kembali kredensial Anda.'
  } finally {
    loading.value = false
  }
}
</script>