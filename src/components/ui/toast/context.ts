import { inject, type InjectionKey } from 'vue'

export type ToastVariant = 'default' | 'success' | 'danger'

export type ToastAction = {
  label: string
  /** Called before the notification is dismissed. */
  onClick?: () => void
}

export type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  /** Overrides the provider default, in milliseconds. Zero keeps it open. */
  duration?: number
  action?: ToastAction
  /** Identity used by `dismiss`; generated when omitted. */
  id?: string
}

export type ToastRecord = ToastOptions & {
  id: string
  variant: ToastVariant
  duration: number
  /** Monotonic counter so re-pushing the same id resets its countdown. */
  version: number
}

export type ToastApi = {
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

export const toastKey: InjectionKey<ToastApi> = Symbol('p0seid0n-toast')

/**
 * Calling this outside a ToastProvider throws rather than silently dropping the
 * notification, so a missing provider surfaces during development.
 */
export function useToast(): ToastApi {
  const api = inject(toastKey, null)
  if (!api) {
    throw new Error('useToast() must be called inside a ToastProvider.')
  }
  return api
}
