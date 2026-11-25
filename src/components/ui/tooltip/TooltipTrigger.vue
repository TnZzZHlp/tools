<script setup lang="ts">
import { TooltipTrigger as SdkTooltipTrigger } from '@ui-sdk/vue/tooltip'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type TooltipTriggerProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<TooltipTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <SdkTooltipTrigger v-bind="$attrs">
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkTooltipTrigger>
</template>
