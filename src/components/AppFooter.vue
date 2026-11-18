<script setup lang="ts">
import { beianText } from '@/lib/icp-beian'

const text = beianText()
</script>

<template>
  <footer
    v-if="text"
    class="mt-auto shrink-0 border-t border-border/60 py-4 text-center text-xs text-muted-foreground"
  >
    {{ text }}
  </footer>
</template>
