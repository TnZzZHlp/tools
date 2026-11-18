<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ListboxContent } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ListboxContent
    v-bind="forwarded"
    :class="
      cn('max-h-72 overflow-x-hidden overflow-y-auto p-1.5 outline-none', attrs.class as ClassValue)
    "
  >
    <slot />
  </ListboxContent>
</template>
