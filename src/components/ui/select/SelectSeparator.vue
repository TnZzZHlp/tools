<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectSeparator as SdkSelectSeparator } from '@ui-sdk/vue/select'
import { selectSeparator } from './styles'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkSelectSeparator v-bind="forwarded" :class="cn(selectSeparator, attrs.class as ClassValue)" />
</template>
