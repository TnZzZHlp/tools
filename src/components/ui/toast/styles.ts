import type { ToastVariant } from './context'

export const toastViewport = [
  'pointer-events-none fixed bottom-4 right-4 z-[60] m-0 w-[min(22rem,calc(100vw-2rem))] [&>[data-slot=toast-list]]:flex [&>[data-slot=toast-list]]:flex-col [&>[data-slot=toast-list]]:gap-2',
].join(' ')

export const toastCard = [
  'pointer-events-auto flex items-start gap-3 rounded-panel border border-line bg-raised p-4 shadow-popup',
].join(' ')

const variantAccent: Record<ToastVariant, string> = {
  default: 'bg-line',
  success: 'bg-accent',
  danger: 'bg-danger',
}

/** Left edge marker that tints the card without recolouring the text. */
export function toastAccent(variant: ToastVariant): string {
  return `absolute inset-y-3 left-0 w-0.5 rounded-full ${variantAccent[variant]}`
}

export const toastTitle = 'text-[14px] font-medium text-ink'

export const toastDescription = 'mt-0.5 text-[13px] text-ink-muted'

export const toastActions = 'mt-2 flex items-center gap-2'

export const toastAction = [
  'h-auto rounded-[8px] border-0 bg-transparent px-2 py-1 text-[12px] font-medium text-ink',
  'hover:bg-control active:scale-95 motion-reduce:active:scale-100',
  'transition-[background-color,color,scale] duration-[var(--p0seid0n-duration-fast)] ease-spring motion-reduce:transition-none',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
].join(' ')

export const toastDismiss = [
  'ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 before:hidden after:hidden',
  'text-[14px] leading-none text-ink-muted',
  'hover:bg-control hover:text-ink active:scale-95 motion-reduce:active:scale-100',
  'transition-[background-color,color,scale] duration-[var(--p0seid0n-duration-fast)] ease-spring motion-reduce:transition-none',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
].join(' ')
