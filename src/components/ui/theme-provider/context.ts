import { inject, type InjectionKey, type Ref } from 'vue'
import { DEFAULT_STORAGE_KEY, type ResolvedTheme, type ThemeChoice } from './theme'

export type ThemeApi = {
  /** The stored choice: system, light or dark. */
  theme: Ref<ThemeChoice>
  /** What is actually painted right now. */
  resolvedTheme: Ref<ResolvedTheme>
  setTheme: (choice: ThemeChoice) => void
  systemTheme: () => ResolvedTheme
  storageKey: string
}

export const themeKey: InjectionKey<ThemeApi> = Symbol('p0seid0n-theme')

export function useTheme(): ThemeApi {
  const api = inject(themeKey, null)
  if (!api) {
    throw new Error('useTheme() must be called inside a ThemeProvider.')
  }
  return api
}

export { DEFAULT_STORAGE_KEY }
