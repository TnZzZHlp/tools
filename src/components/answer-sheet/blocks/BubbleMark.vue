<script setup lang="ts">
defineProps<{ option: string; filled?: boolean }>()
</script>

<template>
  <svg
    class="bubble"
    width="4.4mm"
    height="2.2mm"
    viewBox="0 0 46 23"
    :aria-label="option"
    role="img"
  >
    <rect v-if="filled" x="2" y="1.5" width="42" height="20" fill="currentColor" />
    <template v-else>
      <path
        d="M9 1.5H2V21.5H9 M37 1.5H44V21.5H37"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <text
        x="23"
        y="19"
        text-anchor="middle"
        font-size="21.5"
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
