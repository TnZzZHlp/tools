<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { SelectGroupLabel as SdkSelectGroupLabel } from '@ui-sdk/vue/select'
import { selectGroup } from './selection'
import { selectLabel } from './styles'

defineOptions({ inheritAttrs: false })

const grouped = inject(selectGroup, false)
const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <component
    :is="grouped ? SdkSelectGroupLabel : 'div'"
    v-bind="forwarded"
    :class="cn(selectLabel, attrs.class as ClassValue)"
  >
    <slot />
  </component>
</template>
