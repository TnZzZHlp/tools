<script setup lang="ts">
import { beianText } from '@/lib/icp-beian'

const text = beianText()
</script>

<template>
  <footer v-if="text" class="shrink-0 pt-2 text-center text-xs text-muted-foreground">
    {{ text }}
  </footer>
</template>
