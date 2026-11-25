<script setup lang="ts">
import { Label as SdkLabel } from '@ui-sdk/vue/label'
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ name: 'UiLabel', inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

export type LabelProps = {
  /** Id of the control this label describes; rendered as the `for` attribute. */
  for?: string
  /** Appends a decorative required marker. */
  required?: boolean
}

withDefaults(defineProps<LabelProps>(), {
  for: undefined,
  required: false,
})
</script>

<template>
  <SdkLabel
    v-bind="forwarded"
    :for="$props.for"
    :class="
      cn(
        'inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
    <span v-if="required" aria-hidden="true" class="text-danger">*</span>
  </SdkLabel>
</template>
