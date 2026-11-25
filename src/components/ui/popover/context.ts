import type { InjectionKey, ShallowRef, Ref } from 'vue'

export const popoverContext: InjectionKey<{
  anchor: ShallowRef<HTMLElement | undefined>
  trapFocus: Ref<boolean>
}> = Symbol('p0seid0n-popover')
