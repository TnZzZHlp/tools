import { onMounted, ref } from 'vue'

const THEME_STORAGE_KEY = 'tools:theme'

const isDark = ref(false)
let initialized = false

function applyTheme(dark: boolean) {
  isDark.value = dark
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', dark ? '#11141c' : '#f8fafc')
  }
}

function initTheme() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const dark = saved === 'dark' || (saved !== 'light' && media.matches)
    applyTheme(dark)

    media.addEventListener('change', (event) => {
      const currentSaved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (!currentSaved) {
        applyTheme(event.matches)
      }
    })
  } catch {
    applyTheme(document.documentElement.classList.contains('dark'))
  }
}

export function useTheme() {
  onMounted(() => {
    initTheme()
  })

  function setDark(dark: boolean) {
    applyTheme(dark)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      // Ignore storage failures in private browsing modes.
    }
  }

  function toggleTheme() {
    setDark(!isDark.value)
  }

  return {
    isDark,
    setDark,
    toggleTheme,
  }
}
