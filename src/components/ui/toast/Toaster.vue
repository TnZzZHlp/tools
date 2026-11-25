<script setup lang="ts">
defineOptions({ name: 'UiToaster' })

import { ToastRegion } from '@ui-sdk/vue/toast'
import Toast from './Toast.vue'
import type { ToastRecord } from './context'
import { useToastStack } from './stack'
import { toastViewport } from './styles'

const { toaster, items } = useToastStack()
</script>

<template>
  <ToastRegion
    :toaster="toaster"
    :max-visible="Math.max(1, items.length)"
    expanded
    aria-label="Notifications"
    :class="toastViewport"
  >
    <template #default="{ toast }">
      <Toast :record="toast.data as ToastRecord" />
    </template>
  </ToastRegion>
</template>
