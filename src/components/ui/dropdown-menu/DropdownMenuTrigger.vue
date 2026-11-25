<script setup lang="ts">
import { MenuTrigger as SdkMenuTrigger } from '@ui-sdk/vue/menu'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type DropdownMenuTriggerProps = {
  /** Renders the trigger as another element or component (for example the Button item). */
  as?: string | object
  asChild?: boolean
  disabled?: boolean
}

withDefaults(defineProps<DropdownMenuTriggerProps>(), {
  as: 'button',
  asChild: false,
  disabled: false,
})
</script>

<template>
  <SdkMenuTrigger
    v-bind="$attrs"
    :disabled="disabled"
    :class="!asChild && 'h-auto border-0 bg-transparent p-0'"
  >
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkMenuTrigger>
</template>
