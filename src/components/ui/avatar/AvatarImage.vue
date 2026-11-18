<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AvatarImage } from 'reka-ui'

defineOptions({ inheritAttrs: false })

export type AvatarImageProps = {
  src: string
  alt?: string
}

withDefaults(defineProps<AvatarImageProps>(), {
  alt: '',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AvatarImage
    v-bind="forwarded"
    :src="src"
    :alt="alt"
    :class="cn('aspect-square size-full object-cover', attrs.class as ClassValue)"
  />
</template>
