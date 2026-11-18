import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'

export type DialogBehaviour = {
  closeOnOutside: ComputedRef<boolean>
  closeOnEsc: ComputedRef<boolean>
}

export const dialogBehaviourKey: InjectionKey<DialogBehaviour> = Symbol('p0seid0n-dialog')

export type DialogBehaviourSource = {
  closeOnOutside: () => boolean
  closeOnEsc: () => boolean
}

/**
 * The source is a plain pair of getters rather than the props object: a destructured
 * or defaulted props proxy can resolve before `withDefaults` settles, which would
 * freeze the flags at their defaults.
 */
export function provideDialogBehaviour(source: DialogBehaviourSource): void {
  provide(dialogBehaviourKey, {
    closeOnOutside: computed(source.closeOnOutside),
    closeOnEsc: computed(source.closeOnEsc),
  })
}

const defaults: DialogBehaviour = {
  closeOnOutside: computed(() => true),
  closeOnEsc: computed(() => true),
}

/** Both flags stay true when DialogContent is used without a Dialog parent. */
export function useDialogBehaviour(): DialogBehaviour {
  return inject(dialogBehaviourKey, defaults)
}
