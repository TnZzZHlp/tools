<script setup lang="ts">
defineOptions({ name: 'UiToast' })

import {
  Toast as SdkToast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from '@ui-sdk/vue/toast'
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

defineProps<{ record: ToastRecord }>()
</script>

<template>
  <SdkToast
    :class="
      cn(
        toastCard,
        'relative flex-nowrap overflow-hidden pl-5 motion-safe:animate-toast-in data-ending-style:pointer-events-none data-ending-style:motion-safe:animate-toast-out',
      )
    "
    :style="{ order: record.version }"
    :data-toast-id="record.id"
  >
    <span :class="toastAccent(record.variant)" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <ToastTitle :class="toastTitle" />
      <ToastDescription v-if="record.description" :class="toastDescription" />
      <div v-if="record.action" :class="toastActions">
        <ToastAction :class="toastAction" />
      </div>
    </div>
    <ToastClose aria-label="Dismiss notification" :class="toastDismiss">
      <span aria-hidden="true">&#215;</span>
    </ToastClose>
  </SdkToast>
</template>
