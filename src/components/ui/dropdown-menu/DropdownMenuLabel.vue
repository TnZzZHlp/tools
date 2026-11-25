<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { MenuGroupLabel as SdkMenuGroupLabel } from '@ui-sdk/vue/menu'
import { menuGroup } from './selection'
import { menuLabel } from './styles'

defineOptions({ inheritAttrs: false })

const grouped = inject(menuGroup, false)
const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <component
    :is="grouped ? SdkMenuGroupLabel : 'div'"
    v-bind="forwarded"
    :class="cn(menuLabel, attrs.class as ClassValue)"
  >
    <slot />
  </component>
</template>
