import type { InjectionKey, Ref } from 'vue'

export const menuGroup: InjectionKey<boolean> = Symbol('p0seid0n-menu-group')

export const menuRadioValue: InjectionKey<Ref<string | undefined>> = Symbol('p0seid0n-menu-radio')

export function emitMenuSelect(event: Event, emit: (event: Event) => void) {
  const selection = new CustomEvent('menu.itemSelect', { bubbles: true, cancelable: true })
  emit(selection)
  if (selection.defaultPrevented) event.preventDefault()
}
