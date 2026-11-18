<script setup lang="ts">
defineOptions({ name: 'UiToast' })

import { onBeforeUnmount, onMounted, watch } from 'vue'
import { cn } from '@/lib/utils'
import type { ToastRecord } from './context'
import {
  toastAccent,
  toastAction,
  toastActions,
  toastCard,
  toastDescription,
  toastDismiss,
  toastTitle,
} from './styles'

const props = defineProps<{ record: ToastRecord }>()
const emit = defineEmits<{ dismiss: [id: string] }>()

let timer: ReturnType<typeof setTimeout> | undefined
let hovered = false
let focused = false

function clearTimer(): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

function armTimer(): void {
  clearTimer()
  if (hovered || focused) return
  // A zero duration means the notification stays until dismissed by hand.
  if (props.record.duration > 0) {
    timer = setTimeout(() => emit('dismiss', props.record.id), props.record.duration)
  }
}

function onMouseEnter(): void {
  hovered = true
  clearTimer()
}

function onMouseLeave(): void {
  hovered = false
  armTimer()
}

function onFocusIn(): void {
  focused = true
  clearTimer()
}

function onFocusOut(event: FocusEvent): void {
  const current = event.currentTarget as HTMLElement | null
  const next = event.relatedTarget as Node | null
  if (current && next && current.contains(next)) return
  focused = false
  armTimer()
}

onMounted(armTimer)
// Re-arming on duration or version change resets the countdown when an id is re-pushed.
watch(() => [props.record.duration, props.record.version], armTimer)
onBeforeUnmount(clearTimer)

function runAction(): void {
  props.record.action?.onClick?.()
  emit('dismiss', props.record.id)
}
</script>

<template>
  <div
    :class="cn(toastCard, 'relative overflow-hidden pl-5')"
    :role="record.variant === 'danger' ? 'alert' : 'status'"
    :aria-live="record.variant === 'danger' ? 'assertive' : 'polite'"
    :data-toast-id="record.id"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <span :class="toastAccent(record.variant)" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p :class="toastTitle">{{ record.title }}</p>
      <p v-if="record.description" :class="toastDescription">{{ record.description }}</p>
      <div v-if="record.action" :class="toastActions">
        <button type="button" :class="toastAction" @click="runAction">
          {{ record.action.label }}
        </button>
      </div>
    </div>
    <button
      type="button"
      aria-label="Dismiss notification"
      :class="toastDismiss"
      @click="emit('dismiss', record.id)"
    >
      <span aria-hidden="true">&#215;</span>
    </button>
  </div>
</template>
