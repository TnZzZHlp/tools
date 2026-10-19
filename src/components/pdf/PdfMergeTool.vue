<script setup lang="ts">
import { ref } from 'vue'
import { Download, LoaderCircle, Upload } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PdfFileCard from './PdfFileCard.vue'
import { usePdfMerge } from '@/composables/usePdfMerge'

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
    <Alert
      ><AlertDescription
        >所有文件仅在浏览器本地处理，不会上传。按文件顺序合并，保留文件内部页序；旋转会写入导出的
        PDF。交互表单会转为静态内容，不保留数字签名有效性、书签等文档级信息；不支持加密 PDF 和 XFA
        表单。</AlertDescription
      ></Alert
    >
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
    <div
      class="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
      :class="dragging ? 'border-primary bg-muted' : 'border-border'"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent.stop="dropFiles($event)"
    >
      <Upload class="mx-auto mb-3 size-6 text-muted-foreground" />
      <p class="mb-3 text-sm text-muted-foreground">
        拖入多个 PDF，或点击选择；可继续追加文件。大文件可能占用较多内存，请按设备性能适量添加。
      </p>
      <Button variant="outline" :disabled="busy" @click="fileInput?.click()">{{
        importing ? '正在读取文件…' : '选择 PDF 文件'
      }}</Button>
    </div>
    <p class="text-sm text-muted-foreground" aria-live="polite">
      {{ entries.length }} 个文件 · {{ pageCount }} 页。拖动文件左侧手柄或使用上下箭头调整合并顺序。
    </p>
    <Alert v-if="entries.some((entry) => entry.status === 'error')" variant="destructive"
      ><AlertDescription>存在无法处理的文件，请先移除或替换后再合并。</AlertDescription></Alert
    >
    <div class="space-y-4">
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
    <div class="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
      <div class="min-w-0 flex-1 space-y-2">
        <Label for="pdf-output-name">输出文件名</Label>
        <Input
          id="pdf-output-name"
          v-model="outputName"
          :disabled="busy"
          placeholder="merged.pdf"
        />
      </div>
      <Button :disabled="!canMerge" @click="merge"
        ><LoaderCircle v-if="merging" class="size-4 animate-spin" />{{
          merging ? '正在合并…' : '合并 PDF'
        }}</Button
      >
      <Button v-if="outputUrl" as-child
        ><a :href="outputUrl" :download="downloadName"
          ><Download class="size-4" />下载 PDF</a
        ></Button
      >
    </div>
    <p v-if="outputUrl" class="text-sm text-muted-foreground" role="status">
      合并完成，点击“下载 PDF”保存文件。
    </p>
    <Alert v-if="error" variant="destructive"
      ><AlertDescription>{{ error }}</AlertDescription></Alert
    >
  </div>
</template>
