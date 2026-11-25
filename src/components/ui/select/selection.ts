import type { InjectionKey } from 'vue'

export const selectGroup: InjectionKey<boolean> = Symbol('p0seid0n-select-group')

export const selectItems: InjectionKey<Map<string, (event: Event) => void>> =
  Symbol('p0seid0n-select-items')
