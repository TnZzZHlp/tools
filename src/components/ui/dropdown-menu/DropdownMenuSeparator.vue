<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { MenuSeparator as SdkMenuSeparator } from '@ui-sdk/vue/menu'
import { menuSeparator } from './styles'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkMenuSeparator v-bind="forwarded" :class="cn(menuSeparator, attrs.class as ClassValue)" />
</template>
