<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { createSwitchController, Switch as SwitchRoot, SwitchThumb } from '@ui-sdk/vue/switch'
import type { SwitchController } from '@ui-sdk/vue/switch'

defineOptions({ name: 'UiSwitch', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

export type SwitchProps = {
  disabled?: boolean
  size?: 'md' | 'lg'
  controller?: SwitchController
}

const props = withDefaults(defineProps<SwitchProps>(), {
  disabled: false,
  size: 'md',
  controller: undefined,
})

const model = defineModel<boolean>({ default: false })
const isLarge = computed(() => props.size === 'lg')
const fallbackController = createSwitchController()
const controller = computed(() => props.controller ?? fallbackController)

function onEnter(event: KeyboardEvent) {
  if (event.defaultPrevented || props.disabled) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || target.matches(':disabled, [data-readonly]')) return

  event.preventDefault()
  controller.value.toggle({ reason: 'press', event })
}
</script>

<template>
  <SwitchRoot
    v-model:checked="model"
    v-bind="forwarded"
    :disabled="disabled"
    :controller="controller"
    :class="
      cn(
        'group relative inline-flex shrink-0 items-center rounded-full border border-line bg-control',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
        'data-checked:border-ink data-checked:bg-ink',
        'transition-[background-color,border-color,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-spring motion-reduce:transition-none',
        'disabled:cursor-default disabled:opacity-55',
        isLarge ? 'h-10 w-16 p-[3px]' : 'h-7 w-11 p-px',
        attrs.class as ClassValue,
      )
    "
    @keydown.enter="onEnter"
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none ms-0 flex items-center justify-center rounded-full bg-surface text-ink-muted shadow',
          'transition-transform duration-[var(--p0seid0n-duration-normal)] ease-spring motion-reduce:transition-none',
          'group-active:group-enabled:scale-x-105 motion-reduce:group-active:scale-x-100',
          'data-checked:text-ink',
          isLarge ? 'size-8 data-checked:translate-x-6' : 'size-6 data-checked:translate-x-4',
        )
      "
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
