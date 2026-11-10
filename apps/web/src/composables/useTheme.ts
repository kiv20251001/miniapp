import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const saved = localStorage.getItem('myhome.theme') as ThemeMode | null
const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
const mode = ref<ThemeMode>(saved ?? (systemDark ? 'dark' : 'light'))

function applyTheme() {
  document.documentElement.dataset.theme = mode.value
  document.documentElement.style.colorScheme = mode.value
}

applyTheme()

export function useTheme() {
  const isDark = computed(() => mode.value === 'dark')

  function toggleTheme() {
    mode.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem('myhome.theme', mode.value)
    applyTheme()
  }

  return { mode, isDark, toggleTheme }
}
