<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, Eraser, Info } from 'lucide-vue-next'

import BarcodeSheetPreview from '@/components/BarcodeSheetPreview.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createBarcodeFiles,
  downloadBarcodeFile,
  type BarcodeExportFormat,
} from '@/utils/barcodeExport'
import {
  generateBarcode,
  isValidBarcodeSize,
  parseBarcodeContents,
  type GeneratedBarcode,
} from '@/utils/barcodeGenerator'
import { buildBarcodeSheets, getBarcodeSheetLayout } from '@/utils/barcodeSheet'

const input = ref('')
const width = ref<string | number>(40)
const height = ref<string | number>(20)
const exportError = ref('')
const format = ref<BarcodeExportFormat>('pdf')
const exporting = ref(false)
const selected = ref('0')
const barcodes = computed(() => parseBarcodeContents(input.value).map(generateBarcode))
const validBarcodes = computed(() => barcodes.value.filter((barcode) => !barcode.error))
const selectedBarcode = computed(() => barcodes.value[Number(selected.value)])
const size = computed(() => ({ width: Number(width.value), height: Number(height.value) }))
const validSize = computed(() => isValidBarcodeSize(size.value))
const sheetLayout = computed(() => {
  try {
    return { layout: getBarcodeSheetLayout(size.value), error: '' }
  } catch (error) {
    return { layout: null, error: error instanceof Error ? error.message : '无法排版。' }
  }
})
const sheets = computed(() =>
  validBarcodes.value.length && sheetLayout.value.layout
    ? buildBarcodeSheets(validBarcodes.value, size.value)
    : [],
)
const errorMessage = computed(
  () => exportError.value || sheetLayout.value.error || selectedBarcode.value?.error || '',
)

watch(
  () => barcodes.value.length,
  (length) => {
    if (Number(selected.value) >= length) selected.value = '0'
  },
)
watch([input, width, height, format], () => {
  exportError.value = ''
})

async function exportBarcodes(items: GeneratedBarcode[], index?: number) {
  if (exporting.value) return
  exportError.value = ''
  exporting.value = true
  const selectedFormat = format.value
  try {
    const files = await createBarcodeFiles(items, size.value, selectedFormat, index === undefined)
    const name = index === undefined ? 'barcodes-a4' : `barcode-${index + 1}`
    files.forEach((blob, pageIndex) => {
      const suffix = files.length > 1 ? `-${pageIndex + 1}` : ''
      downloadBarcodeFile(blob, `${name}${suffix}.${selectedFormat}`)
    })
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '导出失败，请重试。'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <Tabs default-value="edit" class="h-full min-h-0 w-full gap-3 overflow-hidden" data-morph-target>
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold tracking-tight sm:text-lg">条形码生成</h2>
        <Badge variant="outline">CODE128</Badge>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="size-7" aria-label="使用说明"
              ><Info class="size-4"
            /></Button>
          </TooltipTrigger>
          <TooltipContent class="max-w-72 space-y-1 text-xs leading-5">
            <p>按换行或中英文逗号分隔，仅支持 ASCII 字符。</p>
            <p>
              条码尺寸包含文字与留白。A4 页边距 10 mm，间距 5 mm，自动分页且不缩放。打印请选择 100%
              原始尺寸。
            </p>
            <p>
              PDF 合并为多页文件；JPG（300 DPI）与 SVG
              每页一个文件，多页导出需允许浏览器下载多个文件。
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <TabsList class="h-8 md:hidden">
        <TabsTrigger value="edit" class="px-3 text-xs">编辑</TabsTrigger>
        <TabsTrigger value="preview" class="px-3 text-xs">预览</TabsTrigger>
      </TabsList>
    </header>

    <div
      class="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-6"
    >
      <TabsContent
        value="edit"
        force-mount
        class="flex min-h-0 min-w-0 flex-col gap-3 data-[state=inactive]:hidden md:data-[state=inactive]:flex"
      >
        <div class="flex min-h-0 flex-1 flex-col gap-2">
          <div class="flex shrink-0 items-center justify-between gap-2">
            <Label for="barcode-contents">条码内容</Label>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              :disabled="!input"
              @click="input = ''"
            >
              <Eraser class="size-3.5" />清空
            </Button>
          </div>
          <Textarea
            id="barcode-contents"
            v-model="input"
            class="hide-scrollbar min-h-0 flex-1 resize-none field-sizing-fixed font-mono text-sm"
            placeholder="按换行或逗号分隔，例如：&#10;ABC123，ITEM-001&#10;1234567890"
            spellcheck="false"
          />
        </div>

        <div class="grid shrink-0 grid-cols-3 gap-2">
          <div class="space-y-1.5">
            <Label for="barcode-width" class="text-xs">宽度 mm</Label>
            <Input
              id="barcode-width"
              v-model="width"
              type="number"
              min="1"
              max="1000"
              step="0.1"
              :aria-invalid="!validSize"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="barcode-height" class="text-xs">高度 mm</Label>
            <Input
              id="barcode-height"
              v-model="height"
              type="number"
              min="1"
              max="1000"
              step="0.1"
              :aria-invalid="!validSize"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="barcode-format" class="text-xs">导出格式</Label>
            <Select v-model="format" :disabled="exporting">
              <SelectTrigger id="barcode-format" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="jpg">JPG</SelectItem>
                <SelectItem value="svg">SVG</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          class="flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span
            >{{ validBarcodes.length }} 个有效<span
              v-if="barcodes.length > validBarcodes.length"
              class="text-destructive"
            >
              · {{ barcodes.length - validBarcodes.length }} 个无效</span
            ></span
          >
          <span v-if="sheetLayout.layout"
            >{{ sheetLayout.layout.columns }} 列 × {{ sheetLayout.layout.rows }} 行 ·
            {{ sheets.length }} 页</span
          >
        </div>
        <p v-if="errorMessage" class="shrink-0 text-xs text-destructive" role="alert">
          {{ errorMessage }}
        </p>

        <div v-if="barcodes.length" class="flex shrink-0 gap-2">
          <Select v-model="selected">
            <SelectTrigger class="min-w-0 flex-1" aria-label="选择单个条码"
              ><SelectValue
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(barcode, index) in barcodes" :key="index" :value="String(index)">
                <span class="block max-w-56 truncate">{{ index + 1 }}. {{ barcode.content }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            class="shrink-0"
            :disabled="!selectedBarcode || !!selectedBarcode.error || !validSize || exporting"
            @click="selectedBarcode && exportBarcodes([selectedBarcode], Number(selected))"
            >导出单个</Button
          >
        </div>
        <Button
          class="shrink-0"
          :disabled="!sheets.length || exporting"
          @click="exportBarcodes(validBarcodes)"
        >
          <Download class="size-4" />{{
            exporting ? '正在导出…' : `导出 A4 ${format.toUpperCase()}`
          }}
        </Button>
      </TabsContent>

      <TabsContent
        value="preview"
        force-mount
        class="flex min-h-0 min-w-0 flex-col data-[state=inactive]:hidden md:data-[state=inactive]:flex"
      >
        <BarcodeSheetPreview :sheets="sheets" />
      </TabsContent>
    </div>
  </Tabs>
</template>

<style scoped>
.hide-scrollbar {
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
