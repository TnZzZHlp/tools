<script setup lang="ts">
import { computed, ref } from 'vue'
import { Barcode, Download, Eraser } from 'lucide-vue-next'

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
const barcodes = computed(() => parseBarcodeContents(input.value).map(generateBarcode))
const validBarcodes = computed(() => barcodes.value.filter((barcode) => !barcode.error))
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
  <section class="flex h-full min-h-0 w-full flex-col overflow-hidden" data-morph-target>
    <header class="mb-4 flex shrink-0 items-center justify-between gap-3 sm:mb-6">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold tracking-tight sm:text-xl">条形码生成</h2>
        <Badge variant="outline">CODE128</Badge>
      </div>
      <Button variant="outline" size="sm" :disabled="!input" @click="input = ''">
        <Eraser class="h-4 w-4" />
        清空
      </Button>
    </header>

    <div class="grid min-h-0 flex-1 gap-6 overflow-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div class="flex min-w-0 flex-col gap-5">
        <div class="flex flex-col gap-2">
          <Label for="barcode-contents">条码内容</Label>
          <Textarea
            id="barcode-contents"
            v-model="input"
            class="min-h-56 resize-y font-mono lg:min-h-72"
            placeholder="ABC123&#10;1234567890，ITEM-001"
            spellcheck="false"
          />
          <p class="text-sm text-muted-foreground">
            按行或逗号分隔，中英文逗号均可，空白项自动忽略。
          </p>
        </div>

        <fieldset class="space-y-3">
          <legend class="text-sm font-medium">导出尺寸（毫米）</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="barcode-width">宽度</Label>
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
            <div class="space-y-2">
              <Label for="barcode-height">高度</Label>
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
          </div>
          <p v-if="!validSize" class="text-sm text-destructive" role="alert">
            宽高必须为 1 至 1000 毫米。
          </p>
          <p class="text-sm leading-relaxed text-muted-foreground">
            每个条码的尺寸包含文字和留白。批量导出按 A4 纵向网格排版，页边距 10 毫米、间距 5
            毫米，超出自动分页，不缩放条码。打印请选择 100% 原始尺寸。
          </p>
        </fieldset>
        <div class="space-y-2">
          <Label for="barcode-format">导出格式</Label>
          <Select v-model="format" :disabled="exporting">
            <SelectTrigger id="barcode-format" class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="jpg">JPG</SelectItem>
              <SelectItem value="svg">SVG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p v-if="sheetLayout.error && validSize" class="text-sm text-destructive" role="alert">
          {{ sheetLayout.error }}
        </p>
        <p v-if="sheets.length && sheetLayout.layout" class="text-sm text-muted-foreground">
          A4 共 {{ sheets.length }} 页，每页最多 {{ sheetLayout.layout.capacity }} 个条码（{{
            sheetLayout.layout.columns
          }}
          列 × {{ sheetLayout.layout.rows }} 行）。
        </p>
        <p class="text-sm leading-relaxed text-muted-foreground">
          PDF 合并为多页文件；JPG（300 DPI）和 SVG
          每页一个文件，多页下载可能需要允许浏览器下载多个文件。单个导出仍使用条码原始尺寸。
        </p>
        <Button :disabled="!sheets.length || exporting" @click="exportBarcodes(validBarcodes)">
          <Download class="h-4 w-4" />
          {{ exporting ? '正在导出…' : `导出 A4 ${format.toUpperCase()}`
          }}<span v-if="validBarcodes.length">（{{ validBarcodes.length }}）</span>
        </Button>
        <p v-if="exportError" class="text-sm text-destructive" role="alert">{{ exportError }}</p>
      </div>

      <section
        class="min-w-0 space-y-3 lg:overflow-auto lg:pr-2"
        aria-label="条码预览"
        aria-live="polite"
      >
        <div
          v-if="!barcodes.length"
          class="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground"
        >
          <Barcode class="h-10 w-10" aria-hidden="true" />
          <p class="text-sm">输入内容后自动生成条码</p>
        </div>
        <figure v-for="(sheet, pageIndex) in sheets" :key="`sheet-${pageIndex}`" class="space-y-2">
          <figcaption class="text-sm text-muted-foreground">
            A4 第 {{ pageIndex + 1 }} 页
          </figcaption>
          <img
            :src="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sheet)}`"
            :alt="`A4 第 ${pageIndex + 1} 页条码排版预览`"
            class="block h-auto w-full border bg-white shadow-sm"
            width="210"
            height="297"
          />
        </figure>
        <article
          v-for="(barcode, index) in barcodes"
          :key="index"
          class="min-w-0 space-y-3 rounded-xl border p-4"
        >
          <div class="flex min-w-0 items-center justify-between gap-3">
            <p class="min-w-0 break-all font-mono text-sm">{{ barcode.content }}</p>
            <Button
              variant="ghost"
              size="sm"
              class="shrink-0"
              :disabled="!!barcode.error || !validSize || exporting"
              :aria-label="`导出第 ${index + 1} 个条码`"
              @click="exportBarcodes([barcode], index)"
            >
              <Download class="h-4 w-4" />
              {{ format.toUpperCase() }}
            </Button>
          </div>
          <p v-if="barcode.error" class="text-sm text-destructive" role="alert">
            {{ barcode.error }}
          </p>
        </article>
      </section>
    </div>
  </section>
</template>
