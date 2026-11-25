<script setup lang="ts">
import { computed, onMounted, ref, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AvatarImage as SdkAvatarImage } from '@ui-sdk/vue/avatar'

defineOptions({ inheritAttrs: false })

export type AvatarImageProps = {
  src: string
  alt?: string
}

withDefaults(defineProps<AvatarImageProps>(), {
  alt: '',
})

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkAvatarImage
    v-bind="forwarded"
    :src="mounted ? src : undefined"
    :alt="alt"
    :class="cn('aspect-square size-full object-cover', attrs.class as ClassValue)"
  />
</template>
