<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { alertVariants, type AlertVariant } from './variants'

defineOptions({ name: 'UiAlert', inheritAttrs: false })

export type AlertProps = {
  variant?: AlertVariant
}

const props = withDefaults(defineProps<AlertProps>(), {
  variant: 'neutral',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.role
  return rest
})

const role = computed(() => {
  return (attrs.role as string | undefined) ?? (props.variant === 'danger' ? 'alert' : 'status')
})

const iconTone = computed(() => {
  if (props.variant === 'danger') return 'text-danger'
  if (props.variant === 'accent') return 'text-accent'
  return 'text-ink-muted'
})
</script>

<template>
  <div
    v-bind="forwarded"
    :role="role"
    :class="cn(alertVariants({ variant }), attrs.class as ClassValue)"
  >
    <span v-if="$slots.icon" :class="cn('mt-0.5 shrink-0', iconTone)">
      <slot name="icon" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <slot />
    </div>
  </div>
</template>
