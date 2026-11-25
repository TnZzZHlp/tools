<script setup lang="ts">
import { DialogTrigger as SdkDialogTrigger } from '@ui-sdk/vue/dialog'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type DialogTriggerProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<DialogTriggerProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <SdkDialogTrigger v-bind="$attrs" :class="!asChild && 'h-auto border-0 bg-transparent p-0'">
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkDialogTrigger>
</template>
