<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { DropdownMenuLabel } from 'reka-ui'
import { menuLabel } from './styles'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <DropdownMenuLabel v-bind="forwarded" :class="cn(menuLabel, attrs.class as ClassValue)">
    <slot />
  </DropdownMenuLabel>
</template>
