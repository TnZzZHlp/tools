<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectTrigger as SdkSelectTrigger } from '@ui-sdk/vue/select'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest['aria-invalid']
  return rest
})

export type SelectTriggerProps = {
  disabled?: boolean
  /** Marks the control as invalid and paints the border with the danger colour. */
  invalid?: boolean
  id?: string
}

const props = withDefaults(defineProps<SelectTriggerProps>(), {
  disabled: false,
  invalid: false,
  id: undefined,
})

const ariaInvalid = computed(() => {
  if (props.invalid) return 'true'
  return attrs['aria-invalid'] as 'true' | 'false' | 'grammar' | 'spelling' | undefined
})
</script>

<template>
  <SdkSelectTrigger
    v-bind="forwarded"
    :id="id"
    :disabled="disabled"
    :aria-invalid="ariaInvalid"
    :class="
      cn(
        'inline-flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-line bg-control px-3 text-[15px] text-ink',
        'data-[placeholder]:text-ink-muted [&>span]:line-clamp-1 after:hidden',
        'outline-none focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger',
        'disabled:cursor-default disabled:opacity-55',
        'transition-[background-color,color,border-color,outline-color,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-out-expo motion-reduce:transition-none',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
    <span aria-hidden="true" class="inline-flex shrink-0">
      <slot name="icon">
        <svg
          class="size-4 shrink-0 text-ink-muted"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </slot>
    </span>
  </SdkSelectTrigger>
</template>
