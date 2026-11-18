<script setup lang="ts">
import { beianText } from '@/lib/icp-beian'

const text = beianText()
</script>

<template>
  <footer
    v-if="text"
    class="mt-auto shrink-0 border-t border-line py-4 text-center text-[12px] text-ink-muted"
  >
    {{ text }}
  </footer>
</template>
