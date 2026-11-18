<script setup lang="ts">
import { ref } from 'vue'
import { Download, FilePlus2, LoaderCircle, Trash2, Upload } from 'lucide-vue-next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePdfMerge } from '@/composables/usePdfMerge'
import PdfFileCard from './PdfFileCard.vue'

const {
  entries,
  busy,
  importing,
  merging,
  error,
  outputUrl,
  outputName,
  downloadName,
  pageCount,
  canMerge,
  addFiles,
  remove,
  move,
  rotate,
  previewError,
  merge,
} = usePdfMerge()

const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)

function selectFiles(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(Array.from(input.files ?? []))
  input.value = ''
}

function clearAll() {
  if (busy.value) return
  const ids = entries.value.map((entry) => entry.id)
  for (const id of ids) {
    remove(id)
  }
}

function dropFiles(event: DragEvent, targetIndex?: number) {
  dragging.value = false
  if (busy.value || !event.dataTransfer) return
  if (event.dataTransfer.files.length) {
    void addFiles(Array.from(event.dataTransfer.files))
    return
  }
  const id = event.dataTransfer.getData('application/x-pdf-entry')
  if (id && targetIndex !== undefined) move(Number(id), targetIndex)
}
</script>

<template>
  <div class="space-y-5" @dragover.prevent @drop.prevent="dropFiles($event)">
    <input
      ref="fileInput"
      type="file"
      accept=".pdf,application/pdf"
      multiple
      class="hidden"
      aria-label="选择 PDF 文件"
      :disabled="busy"
      @change="selectFiles"
    />

    <!-- Clickable Upload Dropzone -->
    <div
      role="button"
      tabindex="0"
      :aria-disabled="busy"
      class="group flex cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed bg-raised px-6 py-8 text-center outline-none transition-[border-color,background-color] duration-[var(--p0seid0n-duration-normal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid sm:py-10"
      :class="[
        dragging
          ? 'border-ink bg-control'
          : 'border-line hover:border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-line))] hover:bg-[color-mix(in_oklab,var(--color-control)_45%,var(--color-raised))]',
        busy && 'pointer-events-none opacity-60',
      ]"
      @click="!busy && fileInput?.click()"
      @keydown.enter.prevent="!busy && fileInput?.click()"
      @keydown.space.prevent="!busy && fileInput?.click()"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent.stop="dropFiles($event)"
    >
      <div
        class="mb-3 flex size-12 items-center justify-center rounded-full border border-line bg-control text-ink-muted transition-colors duration-[var(--p0seid0n-duration-normal)] group-hover:border-ink group-hover:bg-ink group-hover:text-surface"
      >
        <LoaderCircle v-if="importing" class="size-5 animate-spin" />
        <Upload v-else class="size-5" />
      </div>
      <p class="text-[15px] font-medium text-ink">
        {{ importing ? '正在读取 PDF 文件…' : '点击或拖入多个 PDF 文件' }}
      </p>
      <p class="mt-1 max-w-md text-[13px] leading-relaxed text-ink-muted sm:text-[14px]">
        可随时继续追加文件；支持拖动文件卡片调整合并先后顺序，以及单页或整份顺时针旋转。
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        class="pointer-events-none mt-4"
        tabindex="-1"
      >
        <FilePlus2 class="size-4" />
        {{ entries.length ? '继续添加 PDF' : '选择 PDF 文件' }}
      </Button>
    </div>

    <Alert v-if="entries.some((entry) => entry.status === 'error')" variant="danger">
      <AlertDescription>存在无法处理的文件，请先移除异常文件后再执行合并。</AlertDescription>
    </Alert>

    <Alert v-if="error" variant="danger">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- File List Header -->
    <div v-if="entries.length" class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2" aria-live="polite">
        <Badge variant="neutral">{{ entries.length }} 个文件</Badge>
        <Badge variant="outline">共 {{ pageCount }} 页</Badge>
        <span class="hidden text-[12px] text-ink-muted sm:inline">
          拖动左侧手柄或点击上下箭头调整顺序
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="text-ink-muted hover:text-danger"
        :disabled="busy"
        @click="clearAll"
      >
        <Trash2 class="size-4" />
        清空全部
      </Button>
    </div>

    <!-- PDF File Cards -->
    <div v-if="entries.length" class="space-y-4">
      <PdfFileCard
        v-for="(entry, index) in entries"
        :key="entry.id"
        :entry="entry"
        :index="index"
        :count="entries.length"
        :busy="busy"
        @remove="remove(entry.id)"
        @move="move(entry.id, $event)"
        @rotate="rotate(entry.id, $event)"
        @drop-file="dropFiles($event, index)"
        @preview-error="previewError(entry.id, $event)"
      />
    </div>

    <!-- Sticky Bottom Action Bar -->
    <div
      v-if="entries.length"
      class="sticky bottom-4 z-20 rounded-panel border border-line bg-[color-mix(in_oklab,var(--color-raised)_95%,transparent)] p-4 shadow-popup backdrop-blur-md"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="min-w-0 flex-1 space-y-1.5">
          <Label for="pdf-output-name">导出文件名</Label>
          <Input
            id="pdf-output-name"
            v-model="outputName"
            :disabled="busy"
            placeholder="merged.pdf"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            class="flex-1 sm:flex-none"
            :variant="outputUrl ? 'secondary' : 'primary'"
            :disabled="!canMerge"
            :loading="merging"
            @click="merge"
          >
            <LoaderCircle v-if="merging" class="size-4 animate-spin" />
            {{ merging ? '正在合并…' : outputUrl ? '重新合并' : `合并 PDF（${pageCount} 页）` }}
          </Button>

          <Button
            v-if="outputUrl"
            as="a"
            :href="outputUrl"
            :download="downloadName"
            variant="primary"
            class="flex-1 sm:flex-none"
          >
            <Download class="size-4" />
            下载合并结果
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
