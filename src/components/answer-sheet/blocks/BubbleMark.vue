<script setup lang="ts">
defineProps<{ option: string; filled?: boolean }>()
</script>

<template>
  <svg
    class="bubble"
    width="4.6mm"
    height="2.7mm"
    viewBox="0 0 46 27"
    :aria-label="option"
    role="img"
  >
    <rect v-if="filled" x="2" y="2" width="42" height="23" fill="currentColor" />
    <template v-else>
      <path d="M9 2H2V25H9 M37 2H44V25H37" fill="none" stroke="currentColor" stroke-width="2" />
      <text
        x="23"
        y="21.5"
        text-anchor="middle"
        font-size="23"
        font-family="Arial, Helvetica, sans-serif"
        fill="currentColor"
      >
        {{ option }}
      </text>
    </template>
  </svg>
</template>

<style scoped>
.bubble {
  flex: none;
  display: block;
}
</style>
