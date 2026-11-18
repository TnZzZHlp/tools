<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SwitchRoot, SwitchThumb } from 'reka-ui'

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
}

const props = withDefaults(defineProps<SwitchProps>(), {
  disabled: false,
  size: 'md',
})

const model = defineModel<boolean>({ default: false })
const isLarge = computed(() => props.size === 'lg')
</script>

<template>
  <SwitchRoot
    v-model="model"
    v-bind="forwarded"
    :disabled="disabled"
    :class="
      cn(
        'group relative inline-flex shrink-0 items-center rounded-full border border-line bg-control',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
        'data-[state=checked]:border-ink data-[state=checked]:bg-ink',
        'transition-[background-color,border-color,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-spring motion-reduce:transition-none',
        'disabled:cursor-default disabled:opacity-55',
        isLarge ? 'h-10 w-16 p-[3px]' : 'h-7 w-11 p-px',
        attrs.class as ClassValue,
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none flex items-center justify-center rounded-full bg-surface text-ink-muted shadow',
          'transition-transform duration-[var(--p0seid0n-duration-normal)] ease-spring motion-reduce:transition-none',
          'group-active:group-enabled:scale-x-105 motion-reduce:group-active:scale-x-100',
          'data-[state=checked]:text-ink',
          isLarge
            ? 'size-8 data-[state=checked]:translate-x-6'
            : 'size-6 data-[state=checked]:translate-x-4',
        )
      "
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
