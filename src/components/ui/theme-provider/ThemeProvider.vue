<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import {
  DEFAULT_STORAGE_KEY,
  applyThemeToDocument,
  readStoredTheme,
  systemTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from './theme'
import { themeKey, type ThemeApi } from './context'

export type ThemeProviderProps = {
  storageKey?: string
  /** Used when nothing is stored yet. */
  defaultTheme?: ThemeChoice
  /** Attribute mirrored onto `html` so CSS can target the explicit choice. */
  attribute?: string
}

const props = withDefaults(defineProps<ThemeProviderProps>(), {
  storageKey: DEFAULT_STORAGE_KEY,
  defaultTheme: 'system',
  attribute: 'data-theme',
})

const theme = ref<ThemeChoice>(props.defaultTheme)
const resolvedTheme = ref<ResolvedTheme>(props.defaultTheme === 'dark' ? 'dark' : 'light')
const hydrated = ref(false)

let media: MediaQueryList | undefined

function sync(): void {
  resolvedTheme.value = applyThemeToDocument(theme.value, props.attribute)
}

function setTheme(next: ThemeChoice): void {
  theme.value = next
}

// localStorage is written only when the choice changes, not on every system
// preference event: those are not user decisions and must not pin `system`.
watch(theme, (next) => {
  sync()
  if (!hydrated.value) return
  try {
    if (next === 'system' && props.defaultTheme === 'system') {
      localStorage.removeItem(props.storageKey)
    } else {
      localStorage.setItem(props.storageKey, next)
    }
  } catch {
    // A blocked storage backend still needs the in-memory choice to apply.
  }
})

function onSystemChange(): void {
  // Only matters while following the system; a pinned choice ignores it.
  if (theme.value === 'system') sync()
}

onMounted(() => {
  theme.value = readStoredTheme(props.storageKey, props.defaultTheme)
  sync()
  hydrated.value = true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onSystemChange)
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', onSystemChange)
})

const api: ThemeApi = {
  theme,
  resolvedTheme,
  setTheme,
  systemTheme,
  get storageKey() {
    return props.storageKey
  },
}
provide(themeKey, api)

const ready = computed(() => hydrated.value)
defineExpose({ ready, theme, resolvedTheme, setTheme })
</script>

<template>
  <slot />
</template>
