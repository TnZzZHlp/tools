<script setup lang="ts">
import { onScopeDispose } from 'vue'

defineProps<{ direction: 'up' | 'down' }>()
const emit = defineEmits<{ scroll: [] }>()

let timer: ReturnType<typeof setInterval> | undefined

function stop() {
  clearInterval(timer)
  timer = undefined
}

function start(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || timer !== undefined) return
  timer = setInterval(() => emit('scroll'), 80)
}

onScopeDispose(stop)
</script>

<template>
  <button
    type="button"
    tabindex="-1"
    :aria-label="direction === 'up' ? 'Scroll up' : 'Scroll down'"
    class="flex shrink-0 cursor-default items-center justify-center py-1 text-ink-muted"
    @pointerenter="start"
    @pointerleave="stop"
    @pointerdown.prevent
    @click="emit('scroll')"
  >
    <svg
      :class="direction === 'up' ? 'size-3.5 rotate-180' : 'size-3.5'"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  </button>
</template>
