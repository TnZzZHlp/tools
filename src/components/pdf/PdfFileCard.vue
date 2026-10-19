<script setup lang="ts">
import { ArrowDown, ArrowUp, GripVertical, RotateCw, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import PdfThumbnail from './PdfThumbnail.vue'
import type { PdfEntry } from '@/composables/usePdfMerge'

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
  <Card class="gap-3" @dragover.prevent @drop.prevent.stop="emit('dropFile', $event)">
    <CardHeader class="gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span
          :draggable="!busy"
          class="cursor-grab rounded p-2 text-muted-foreground"
          aria-label="拖动调整文件顺序"
          title="拖动调整文件顺序"
          @dragstart="dragStart"
          ><GripVertical class="size-4"
        /></span>
        <div class="min-w-0 flex-1">
          <h3 class="break-all font-medium">{{ index + 1 }}. {{ entry.file.name }}</h3>
          <p class="text-xs text-muted-foreground">
            {{ (entry.file.size / 1024 / 1024).toFixed(2) }} MB ·
            {{ entry.status === 'loading' ? '正在读取' : `${entry.rotations.length} 页` }}
          </p>
        </div>
        <div class="flex flex-wrap gap-1">
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || entry.status !== 'ready'"
            @click="emit('rotate')"
            ><RotateCw class="size-4" />整份旋转</Button
          >
          <Button
            variant="ghost"
            size="icon"
            :disabled="busy || index === 0"
            :aria-label="`上移 ${entry.file.name}`"
            @click="emit('move', index - 1)"
            ><ArrowUp class="size-4"
          /></Button>
          <Button
            variant="ghost"
            size="icon"
            :disabled="busy || index === count - 1"
            :aria-label="`下移 ${entry.file.name}`"
            @click="emit('move', index + 1)"
            ><ArrowDown class="size-4"
          /></Button>
          <Button
            variant="ghost"
            size="icon"
            :disabled="busy"
            :aria-label="`移除 ${entry.file.name}`"
            @click="emit('remove')"
            ><Trash2 class="size-4"
          /></Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <Alert v-if="entry.status === 'error'" variant="destructive"
        ><AlertDescription>{{ entry.error }}。请移除或替换该文件后再合并。</AlertDescription></Alert
      >
      <p v-else-if="entry.status === 'loading'" class="text-sm text-muted-foreground" role="status">
        正在读取 PDF…
      </p>
      <div
        v-else-if="entry.document"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
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
