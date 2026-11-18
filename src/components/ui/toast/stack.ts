import { inject, provide, shallowRef, type InjectionKey, type Ref } from 'vue'
import type { ToastOptions, ToastRecord } from './context'

export type ToastStack = {
  items: Ref<ToastRecord[]>
  push: (options: ToastOptions, duration: number, max: number) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

export const toastStackKey: InjectionKey<ToastStack> = Symbol('p0seid0n-toast-stack')

/**
 * The stack lives outside the provider component so the viewport can read the same
 * reactive list without prop drilling through slots.
 */
export function createToastStack(): ToastStack {
  const items = shallowRef<ToastRecord[]>([])
  let sequence = 0

  function dismiss(id: string): void {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function dismissAll(): void {
    items.value = []
  }

  function push(options: ToastOptions, duration: number, max: number): string {
    sequence += 1
    const id = options.id ?? `p0seid0n-toast-${sequence}`
    const record: ToastRecord = {
      ...options,
      id,
      variant: options.variant ?? 'default',
      duration: options.duration ?? duration,
      version: sequence,
    }

    // Re-pushing an id moves it to the top of the stack instead of duplicating it.
    const withoutDuplicate = items.value.filter((item) => item.id !== id)
    const next = [...withoutDuplicate, record]
    // The cap trims the oldest entries, so a burst keeps the most recent ones.
    items.value = next.slice(Math.max(0, next.length - Math.max(1, max)))
    return id
  }

  return { items, push, dismiss, dismissAll }
}

export function provideToastStack(stack: ToastStack): void {
  provide(toastStackKey, stack)
}

export function useToastStack(): ToastStack {
  const stack = inject(toastStackKey, null)
  if (!stack) {
    throw new Error('ToastProvider is required to render notifications.')
  }
  return stack
}
