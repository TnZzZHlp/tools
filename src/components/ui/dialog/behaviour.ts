import type {
  DialogFinalFocus,
  DialogInitialFocus,
  DialogOpenChangeDetails,
} from '@ui-sdk/vue/dialog'
import { inject, onScopeDispose, provide, type InjectionKey } from 'vue'

export type PanelFocusProps = {
  initialFocus?: DialogInitialFocus
  finalFocus?: DialogFinalFocus
}

type DismissHandler = (details: DialogOpenChangeDetails) => void
const behaviourKey: InjectionKey<Set<DismissHandler>> = Symbol('p0seid0n-dialog')

type DismissOptions = {
  closeOnOutside: () => boolean
  closeOnEsc: () => boolean
}
const defaults: DismissOptions = {
  closeOnOutside: () => true,
  closeOnEsc: () => true,
}

export function provideDialogBehaviour(options = defaults) {
  const handlers = new Set<DismissHandler>()
  provide(behaviourKey, handlers)

  return (open: boolean, details: DialogOpenChangeDetails) => {
    if (open) return
    if (
      (details.reason === 'outside-press' && !options.closeOnOutside()) ||
      (details.reason === 'escape-key' && !options.closeOnEsc())
    ) {
      details.cancel()
    }
    for (const handler of handlers) handler(details)
  }
}

export type PointerDownOutsideEvent = CustomEvent<{ originalEvent: MouseEvent }>

type DismissEvents = {
  escapeKeyDown: (event: KeyboardEvent) => void
  pointerDownOutside: (event: PointerDownOutsideEvent) => void
  interactOutside: (event: Event) => void
}

export function useDialogDismiss(events: DismissEvents, options = defaults) {
  const handlers = inject(behaviourKey, null)
  const handler: DismissHandler = (details) => {
    const original = details.event
    if (details.reason === 'escape-key' && original instanceof KeyboardEvent) {
      const event = new KeyboardEvent(original.type, {
        key: original.key,
        code: original.code,
        altKey: original.altKey,
        ctrlKey: original.ctrlKey,
        metaKey: original.metaKey,
        shiftKey: original.shiftKey,
        cancelable: true,
      })
      if (details.canceled || !options.closeOnEsc()) event.preventDefault()
      events.escapeKeyDown(event)
      if (event.defaultPrevented) details.cancel()
    } else if (details.reason === 'outside-press' && original instanceof MouseEvent) {
      const event = new CustomEvent('dismissableLayer.pointerDownOutside', {
        cancelable: true,
        detail: { originalEvent: original },
      })
      if (details.canceled || !options.closeOnOutside()) event.preventDefault()
      events.pointerDownOutside(event)
      events.interactOutside(event)
      if (event.defaultPrevented) details.cancel()
    }
  }
  handlers?.add(handler)
  onScopeDispose(() => handlers?.delete(handler))
}
