<script setup lang="ts">
import type { Component } from 'vue'
import { AlertDialogTrigger as SdkAlertDialogTrigger } from '@ui-sdk/vue/alert-dialog'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type AlertDialogTriggerProps = {
  as?: string | Component
  asChild?: boolean
}

withDefaults(defineProps<AlertDialogTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <SdkAlertDialogTrigger v-bind="$attrs" :class="!asChild && 'h-auto border-0 bg-transparent p-0'">
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkAlertDialogTrigger>
</template>
