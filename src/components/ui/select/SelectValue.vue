<script setup lang="ts">
import { SelectValue as SdkSelectValue } from '@ui-sdk/vue/select'

defineOptions({ inheritAttrs: false })

export type SelectValueProps = {
  placeholder?: string
}

withDefaults(defineProps<SelectValueProps>(), {
  placeholder: undefined,
})
</script>

<template>
  <SdkSelectValue
    v-if="$slots.default"
    v-slot="{ state }"
    :placeholder="placeholder"
    v-bind="$attrs"
  >
    <slot :model-value="state.value ?? undefined" :selected-label="state.labels" />
  </SdkSelectValue>
  <SdkSelectValue v-else :placeholder="placeholder" v-bind="$attrs" />
</template>
