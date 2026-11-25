<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { AvatarFallback as SdkAvatarFallback } from '@ui-sdk/vue/avatar'

defineOptions({ inheritAttrs: false })

export type AvatarFallbackProps = {
  delayMs?: number
}

withDefaults(defineProps<AvatarFallbackProps>(), {
  delayMs: undefined,
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkAvatarFallback
    v-bind="forwarded"
    :delay="delayMs"
    :class="
      cn(
        'flex size-full items-center justify-center bg-control font-medium text-ink-muted',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </SdkAvatarFallback>
</template>
