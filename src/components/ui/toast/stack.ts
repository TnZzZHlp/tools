import { createOverlays } from '@ui-sdk/core/overlays'
import { createToaster, type ToastContent } from '@ui-sdk/vue/toast'
import { inject, provide, shallowRef, type InjectionKey, type Ref } from 'vue'
import type { ToastOptions, ToastRecord } from './context'

export type ToastStack = {
  items: Ref<ToastRecord[]>
  toaster: ReturnType<typeof createToaster<ToastContent>>
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
  const toaster = createToaster({ overlays: createOverlays() })
  const items = shallowRef<ToastRecord[]>([])
  let sequence = 0

  toaster.subscribe(() => {
    items.value = toaster
      .toasts()
      .map((toast) => toast.data as ToastRecord)
      .sort((a, b) => a.version - b.version)
  })

  function dismiss(id: string): void {
    toaster.dismiss(id)
  }

  function dismissAll(): void {
    toaster.dismiss()
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

    const existing = items.value.filter((item) => item.id !== id)
    for (const oldest of existing.slice(0, Math.max(0, existing.length + 1 - Math.max(1, max)))) {
      toaster.dismiss(oldest.id)
    }

    toaster({
      id,
      title: record.title,
      description: record.description,
      type: record.variant === 'danger' ? 'error' : record.variant,
      duration: record.duration > 0 ? record.duration : Infinity,
      action: record.action
        ? { label: record.action.label, onAction: record.action.onClick, dismiss: true }
        : undefined,
      data: record,
    })
    return id
  }

  return { items, toaster, push, dismiss, dismissAll }
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
