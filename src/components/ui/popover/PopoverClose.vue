<script setup lang="ts">
import type { Component } from 'vue'
import { PopoverClose as SdkPopoverClose } from '@ui-sdk/vue/popover'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type PopoverCloseProps = {
  as?: string | Component
  asChild?: boolean
}

withDefaults(defineProps<PopoverCloseProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <SdkPopoverClose v-bind="$attrs" :class="!asChild && 'h-auto border-0 bg-transparent p-0'">
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkPopoverClose>
</template>
