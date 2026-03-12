<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <h3 :class="cn('text-xl leading-none font-semibold', $props.class)">
    <span
      class="relative inline-flex after:absolute after:bottom-[-0.35em] after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:content-[''] group-hover:after:scale-x-100"
    >
      <slot />
    </span>
  </h3>
</template>
