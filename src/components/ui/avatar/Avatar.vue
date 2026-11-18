<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AvatarRoot } from 'reka-ui'
import { avatarVariants, type AvatarShape, type AvatarSize } from './variants'

defineOptions({ name: 'UiAvatar', inheritAttrs: false })

export type AvatarProps = {
  size?: AvatarSize
  shape?: AvatarShape
}

withDefaults(defineProps<AvatarProps>(), {
  size: 'md',
  shape: 'circle',
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <AvatarRoot
    v-bind="forwarded"
    :class="cn(avatarVariants({ size, shape }), attrs.class as ClassValue)"
  >
    <slot />
  </AvatarRoot>
</template>
