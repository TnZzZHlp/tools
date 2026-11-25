import type { InjectionKey, Ref } from 'vue'

export const tabsContext: InjectionKey<{
  loop: Ref<boolean>
  unmountOnHide: Readonly<Ref<boolean>>
}> = Symbol('p0seid0n-tabs')

export function encodeTab(value: string | number) {
  return typeof value === 'number' ? `n:${value}` : `s:${value}`
}

export function decodeTab(value: string) {
  return value.startsWith('n:') ? Number(value.slice(2)) : value.slice(2)
}
