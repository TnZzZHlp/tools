<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { RotateCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { renderThumbnail } from '@/lib/pdf/preview'

const props = defineProps<{
  document: PDFDocumentProxy
  page: number
  rotation: number
  disabled: boolean
}>()
const emit = defineEmits<{ rotate: []; error: [message: string] }>()
const container = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const ready = ref(false)
let observer: IntersectionObserver | undefined
let render: ReturnType<typeof renderThumbnail> | undefined
let disposed = false

function setVisible(visible: boolean) {
  if (!canvas.value) return
  render?.cancel()
  if (!visible) {
    const previous = render
    render = undefined
    ready.value = false
    void previous?.done
      .catch(() => {})
      .then(() => {
        if (!render && canvas.value) {
          canvas.value.width = 0
          canvas.value.height = 0
        }
      })
    return
  }
  const current = renderThumbnail(props.document, props.page, canvas.value)
  render = current
  void current.done
    .then(() => {
      if (!disposed && render === current) ready.value = true
    })
    .catch((cause: unknown) => {
      if (
        !disposed &&
        render === current &&
        !(cause instanceof Error && cause.name === 'RenderingCancelledException')
      ) {
        emit('error', `第 ${props.page} 页预览失败，请确认 PDF 内容可正常读取`)
      }
    })
}

onMounted(() => {
  observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
    rootMargin: '200px',
  })
  if (container.value) observer.observe(container.value)
})

onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  render?.cancel()
})
</script>

<template>
  <div ref="container" class="space-y-2 rounded-lg border p-2">
    <div
      class="relative flex h-48 items-center justify-center overflow-hidden rounded bg-muted/50"
      :aria-label="`第 ${page} 页预览`"
    >
      <span v-if="!ready" class="absolute text-xs text-muted-foreground">正在加载预览</span>
      <canvas
        ref="canvas"
        class="max-h-40 max-w-40 object-contain transition-transform"
        :class="{ 'opacity-0': !ready }"
        :style="{ transform: `rotate(${rotation}deg)` }"
      />
    </div>
    <div class="flex items-center justify-between gap-1">
      <span class="text-xs text-muted-foreground">第 {{ page }} 页</span>
      <Button
        variant="ghost"
        size="icon"
        :disabled="disabled"
        :aria-label="`第 ${page} 页顺时针旋转 90°`"
        @click="emit('rotate')"
        ><RotateCw class="size-4"
      /></Button>
    </div>
  </div>
</template>
