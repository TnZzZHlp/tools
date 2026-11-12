<script setup lang="ts">
import '@/styles/route-transition.css'
import '@/styles/route-morph.css'
import { onBeforeUnmount, onMounted } from 'vue'
import type { Router } from 'vue-router'
import { installRouteMorph, supportsViewTransition } from '@/lib/route-morph'

const props = defineProps<{ routeKey: string; appear?: boolean; router: Router }>()

const nativeMorph = supportsViewTransition()
let dispose: (() => void) | undefined
onMounted(() => {
  dispose = installRouteMorph(props.router)
})
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <Transition v-if="!nativeMorph" name="route" mode="out-in" :appear="appear">
    <div :key="routeKey" class="route-surface">
      <slot />
    </div>
  </Transition>
  <div v-else :key="routeKey" class="route-surface">
    <slot />
  </div>
</template>
