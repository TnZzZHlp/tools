<script setup lang="ts">
import type { Component } from 'vue'
import { inject, useTemplateRef, watchEffect, type ComponentPublicInstance } from 'vue'
import { RenderChild } from '@/lib/render-child'
import { popoverContext } from './context'

defineOptions({ inheritAttrs: false })

export type PopoverAnchorProps = {
  as?: string | Component
  asChild?: boolean
}

withDefaults(defineProps<PopoverAnchorProps>(), {
  as: 'div',
  asChild: false,
})

const context = inject(popoverContext)
const anchor = useTemplateRef<HTMLElement | ComponentPublicInstance>('anchor')
watchEffect((onCleanup) => {
  if (!context || !anchor.value) return
  const value = anchor.value instanceof HTMLElement ? anchor.value : anchor.value.$el
  if (!(value instanceof HTMLElement)) return
  context.anchor.value = value
  onCleanup(() => {
    if (context.anchor.value === value) context.anchor.value = undefined
  })
})
</script>

<template>
  <RenderChild v-if="asChild" ref="anchor" v-bind="$attrs"><slot /></RenderChild>
  <component :is="as" v-else ref="anchor" v-bind="$attrs"><slot /></component>
</template>
