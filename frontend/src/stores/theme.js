import { defineStore } from 'pinia'

const THEME_KEY = 'andon_theme'

const readStored = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark'
  } catch {
    return false
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    dark: readStored(),
  }),
  actions: {
    init() {
      this.apply()
    },
    toggle() {
      this.dark = !this.dark
      try {
        localStorage.setItem(THEME_KEY, this.dark ? 'dark' : 'light')
      } catch {
        /* storage tidak tersedia */
      }
      this.apply()
    },
    apply() {
      document.documentElement.classList.toggle('dark', this.dark)
    },
  },
})