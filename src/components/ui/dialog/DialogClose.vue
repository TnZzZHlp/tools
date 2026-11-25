<script setup lang="ts">
import { DialogClose as SdkDialogClose } from '@ui-sdk/vue/dialog'
import { RenderChild } from '@/lib/render-child'

defineOptions({ inheritAttrs: false })

export type DialogCloseProps = {
  as?: string | object
  asChild?: boolean
}

withDefaults(defineProps<DialogCloseProps>(), {
  as: 'button',
  asChild: false,
})
</script>

<template>
  <SdkDialogClose v-bind="$attrs" :class="!asChild && 'h-auto border-0 bg-transparent p-0'">
    <template #render="{ props: part }">
      <RenderChild v-if="asChild" v-bind="part"><slot /></RenderChild>
      <component :is="as" v-else v-bind="part"><slot /></component>
    </template>
  </SdkDialogClose>
</template>
