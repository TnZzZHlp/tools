<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle, RotateCw, Trash2 } from 'lucide-vue-next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PdfEntry } from '@/composables/usePdfMerge'
import PdfThumbnail from './PdfThumbnail.vue'

const props = defineProps<{ entry: PdfEntry; index: number; count: number; busy: boolean }>()
const emit = defineEmits<{
  remove: []
  move: [index: number]
  rotate: [page?: number]
  dropFile: [event: DragEvent]
  previewError: [message: string]
}>()

function dragStart(event: DragEvent) {
  if (props.busy || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-pdf-entry', String(props.entry.id))
}
</script>

<template>
  <Card @dragover.prevent @drop.prevent.stop="emit('dropFile', $event)">
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2 sm:px-5">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span
          :draggable="!busy"
          class="cursor-grab rounded-[8px] p-1.5 text-ink-muted transition-colors hover:bg-control hover:text-ink active:cursor-grabbing"
          aria-label="拖动调整文件顺序"
          title="拖动调整文件顺序"
          @dragstart="dragStart"
        >
          <GripVertical class="size-4" />
        </span>

        <Badge variant="neutral" class="shrink-0 tabular-nums">#{{ index + 1 }}</Badge>

        <div class="min-w-0 flex-1">
          <h3 class="truncate text-[15px] font-medium text-ink" :title="entry.file.name">
            {{ entry.file.name }}
          </h3>
          <p class="text-[12px] tabular-nums text-ink-muted">
            {{ (entry.file.size / 1024 / 1024).toFixed(2) }} MB ·
            {{ entry.status === 'loading' ? '读取中…' : `${entry.rotations.length} 页` }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          :disabled="busy || entry.status !== 'ready'"
          @click="emit('rotate')"
        >
          <RotateCw class="size-3.5" />
          整份旋转
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="w-8 px-0"
          :disabled="busy || index === 0"
          :aria-label="`上移 ${entry.file.name}`"
          @click="emit('move', index - 1)"
        >
          <ArrowUp class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="w-8 px-0"
          :disabled="busy || index === count - 1"
          :aria-label="`下移 ${entry.file.name}`"
          @click="emit('move', index + 1)"
        >
          <ArrowDown class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="w-8 px-0 text-ink-muted hover:text-danger"
          :disabled="busy"
          :aria-label="`移除 ${entry.file.name}`"
          @click="emit('remove')"
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </div>

    <CardContent class="px-4 pt-2 pb-4 sm:px-5">
      <Alert v-if="entry.status === 'error'" variant="danger" class="bg-surface">
        <AlertDescription>{{ entry.error }}。请移除或替换该文件后再合并。</AlertDescription>
      </Alert>

      <div
        v-else-if="entry.status === 'loading'"
        class="flex items-center gap-2 py-4 text-[14px] text-ink-muted"
        role="status"
      >
        <LoaderCircle class="size-4 animate-spin" />
        <span>正在解析 PDF 页面预览…</span>
      </div>

      <div
        v-else-if="entry.document"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
      >
        <PdfThumbnail
          v-for="(rotation, page) in entry.rotations"
          :key="page"
          :document="entry.document"
          :page="page + 1"
          :rotation="rotation"
          :disabled="busy"
          @rotate="emit('rotate', page)"
          @error="emit('previewError', $event)"
        />
      </div>
    </CardContent>
  </Card>
</template>
