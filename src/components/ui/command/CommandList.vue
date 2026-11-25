<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CommandList as SdkCommandList } from '@ui-sdk/vue/command'
import { useCommandContext } from './context'

defineOptions({ inheritAttrs: false })

const { multiple } = useCommandContext()
const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkCommandList
    v-bind="forwarded"
    :aria-multiselectable="multiple || undefined"
    :class="
      cn('max-h-72 overflow-x-hidden overflow-y-auto p-1.5 outline-none', attrs.class as ClassValue)
    "
  >
    <slot />
  </SdkCommandList>
</template>
