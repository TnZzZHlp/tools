<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { RadioGroupRoot } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})

export type RadioGroupProps = {
  defaultValue?: string
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  loop?: boolean
  name?: string
  required?: boolean
}

withDefaults(defineProps<RadioGroupProps>(), {
  defaultValue: undefined,
  disabled: false,
  orientation: 'vertical',
  loop: true,
  name: undefined,
  required: false,
})

const model = defineModel<string>()
</script>

<template>
  <RadioGroupRoot
    v-bind="forwarded"
    v-model="model"
    :default-value="defaultValue"
    :disabled="disabled"
    :orientation="orientation"
    :loop="loop"
    :name="name"
    :required="required"
    :class="
      cn(
        'grid gap-2.5',
        'data-[orientation=horizontal]:grid-flow-col data-[orientation=horizontal]:auto-cols-max data-[orientation=horizontal]:items-center data-[orientation=horizontal]:gap-4',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </RadioGroupRoot>
</template>
