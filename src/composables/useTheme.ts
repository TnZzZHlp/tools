import { computed, watch } from 'vue'
import { useTheme as useP0seid0nTheme } from '@/components/ui/theme-provider'

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useP0seid0nTheme()

  const isDark = computed(() => resolvedTheme.value === 'dark')

  watch(
    resolvedTheme,
    (current) => {
      if (typeof document === 'undefined') return
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        meta.setAttribute('content', current === 'dark' ? '#121419' : '#F5F6F8')
      }
    },
    { immediate: true },
  )

  function setDark(dark: boolean) {
    setTheme(dark ? 'dark' : 'light')
  }

  function toggleTheme() {
    setDark(!isDark.value)
  }

  return {
    theme,
    resolvedTheme,
    isDark,
    setTheme,
    setDark,
    toggleTheme,
  }
}
