<script setup lang="ts">
import '@/styles/route-transition.css'

defineProps<{
  routeKey: string
  appear?: boolean
}>()
</script>

<template>
  <Transition name="route" mode="out-in" :appear="appear">
    <div :key="routeKey" class="route-surface">
      <slot />
    </div>
  </Transition>
</template>
