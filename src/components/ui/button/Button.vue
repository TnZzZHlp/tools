<script setup lang="ts">
import { Button as SdkButton } from '@ui-sdk/vue/button'
import { computed, useAttrs } from 'vue'
import type { Component } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { buttonVariants } from './variants'
import type { ButtonSize, ButtonVariant } from './variants'

defineOptions({ name: 'UiButton', inheritAttrs: false })

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Rendered element or component. Links pass as: 'a'. */
  as?: string | Component
  /** Native button type; ignored when `as` is not a button. */
  type?: 'button' | 'submit' | 'reset'
  /** Disables interaction and marks the button as busy. */
  loading?: boolean
  disabled?: boolean
}

type ClickHandler = (event: MouseEvent) => void

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  as: 'button',
  type: 'button',
  loading: false,
  disabled: false,
})

const attrs = useAttrs()

// The click listener is attached by this component so that `loading` and
// `disabled` also block it for non-button roots such as links.
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.onClick
  return rest
})

const isNativeButton = computed(() => props.as === 'button')
const isInert = computed(() => props.disabled || props.loading)

function onClick(event: MouseEvent): void {
  if (isInert.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  const raw = attrs.onClick as ClickHandler | ClickHandler[] | undefined
  if (Array.isArray(raw)) {
    for (const handler of raw) handler(event)
  } else {
    raw?.(event)
  }
}

function onAuxClick(event: MouseEvent): void {
  if (isInert.value) {
    event.preventDefault()
  }
}
</script>

<template>
  <component
    :is="isNativeButton ? SdkButton : as"
    v-bind="forwarded"
    :type="isNativeButton ? type : undefined"
    :class="
      cn(
        isNativeButton && 'h-auto border-0',
        buttonVariants({ variant, size }),
        attrs.class as ClassValue,
      )
    "
    :disabled="isNativeButton ? isInert : undefined"
    :tabindex="!isNativeButton && isInert ? -1 : (attrs.tabindex as number | string | undefined)"
    :aria-disabled="isInert ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    @click="onClick"
    @auxclick="onAuxClick"
  >
    <slot name="progress" />
    <slot name="leading" />
    <slot />
    <slot name="trailing" />
  </component>
</template>
