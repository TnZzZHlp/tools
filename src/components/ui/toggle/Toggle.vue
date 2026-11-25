<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Toggle as ToggleRoot } from '@ui-sdk/vue/toggle'
import { toggleVariants, type ToggleSize, type ToggleVariant } from './variants'

defineOptions({ name: 'UiToggle', inheritAttrs: false })

export type ToggleProps = {
  /** Initial pressed state when uncontrolled. */
  defaultValue?: boolean
  disabled?: boolean
  variant?: ToggleVariant
  size?: ToggleSize
  name?: string
  required?: boolean
}

const props = withDefaults(defineProps<ToggleProps>(), {
  defaultValue: false,
  disabled: false,
  variant: 'default',
  size: 'md',
  name: undefined,
  required: false,
})

const model = defineModel<boolean | undefined>({ default: undefined })
const internal = ref(props.defaultValue)
const pressed = computed({
  get: () => model.value ?? internal.value,
  set: (value) => {
    internal.value = value
    model.value = value
  },
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ToggleRoot
    v-model:pressed="pressed"
    v-bind="forwarded"
    :disabled="disabled"
    :class="cn(toggleVariants({ variant, size }), attrs.class as ClassValue)"
  >
    <template #render="{ props: part, state }">
      <button v-bind="part" :data-state="state.pressed ? 'on' : 'off'">
        <slot
          :model-value="state.pressed"
          :disabled="state.disabled"
          :pressed="state.pressed"
          :state="state.pressed ? 'on' : 'off'"
        />
      </button>
    </template>
  </ToggleRoot>
  <input
    v-if="name"
    type="checkbox"
    class="sr-only"
    aria-hidden="true"
    tabindex="-1"
    :checked="pressed"
    :disabled="disabled"
    :required="required"
    :name="name"
    value="true"
  />
</template>
