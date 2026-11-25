<script setup lang="ts">
import { createLocalStorage, createPreference } from '@ui-sdk/core'
import { usePreference } from '@ui-sdk/vue/preferences'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import {
  DEFAULT_STORAGE_KEY,
  applyThemeToDocument,
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

const storage = createLocalStorage(props.storageKey)
const preference = createPreference({
  values: ['system', 'light', 'dark'],
  defaultValue: props.defaultTheme,
  attribute: 'data-p0seid0n-theme-preference',
  storage: {
    ...storage,
    set: (value) =>
      value === 'system' && props.defaultTheme === 'system' ? storage.remove() : storage.set(value),
  },
})
const preferenceState = usePreference(preference)
const theme = computed({
  get: () => preferenceState.value.value,
  set: (next: ThemeChoice) => {
    preference.set(next)
  },
})
const resolvedTheme = ref<ResolvedTheme>(props.defaultTheme === 'dark' ? 'dark' : 'light')
const hydrated = ref(false)

let media: MediaQueryList | undefined

function sync(): void {
  resolvedTheme.value = applyThemeToDocument(theme.value, props.attribute)
}

function setTheme(next: ThemeChoice): void {
  theme.value = next
}

watch(theme, sync)

function onSystemChange(): void {
  // Only matters while following the system; a pinned choice ignores it.
  if (theme.value === 'system') sync()
}

onMounted(() => {
  sync()
  hydrated.value = true
  if (typeof window.matchMedia === 'function') {
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', onSystemChange)
  }
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
