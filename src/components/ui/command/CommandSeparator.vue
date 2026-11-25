<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CommandSeparator as SdkCommandSeparator } from '@ui-sdk/vue/command'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkCommandSeparator
    v-bind="forwarded"
    :class="cn('my-1 h-px bg-line', attrs.class as ClassValue)"
  />
</template>
