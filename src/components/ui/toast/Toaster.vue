<script setup lang="ts">
defineOptions({ name: 'UiToaster' })

import { onMounted, ref } from 'vue'
import Toast from './Toast.vue'
import { useToastStack } from './stack'
import { toastViewport } from './styles'

const stack = useToastStack()
const mounted = ref(false)
const leavingCount = ref(0)

onMounted(() => {
  mounted.value = true
})

function onBeforeLeave(): void {
  leavingCount.value += 1
}

function onLeaveDone(): void {
  leavingCount.value = Math.max(0, leavingCount.value - 1)
}
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <TransitionGroup
      v-if="stack.items.value.length > 0 || leavingCount > 0"
      appear
      tag="div"
      :class="toastViewport"
      role="region"
      aria-label="Notifications"
      enter-active-class="motion-safe:animate-toast-in"
      leave-active-class="pointer-events-none motion-safe:animate-toast-out"
      move-class="transition-transform duration-[var(--p0seid0n-duration-slow)] ease-out-expo motion-reduce:transition-none"
      @before-leave="onBeforeLeave"
      @after-leave="onLeaveDone"
      @leave-cancelled="onLeaveDone"
    >
      <Toast
        v-for="record in stack.items.value"
        :key="record.id"
        :record="record"
        @dismiss="stack.dismiss"
      />
    </TransitionGroup>
  </Teleport>
</template>
