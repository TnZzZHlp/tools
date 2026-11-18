<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Barcode, Download, Eraser, Info, Sparkles } from 'lucide-vue-next'

import BarcodeSheetPreview from '@/components/BarcodeSheetPreview.vue'
import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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

const SAMPLE_BARCODES =
  'SKU-2026-001\nSKU-2026-002\nSKU-2026-003\nSKU-2026-004\nSKU-2026-005\nSKU-2026-006'

const SIZE_PRESETS = [
  { label: '30×15', w: 30, h: 15 },
  { label: '40×20', w: 40, h: 20 },
  { label: '50×30', w: 50, h: 30 },
  { label: '60×40', w: 60, h: 40 },
]

const mobileTab = ref('edit')
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

function applySizePreset(w: number, h: number) {
  width.value = w
  height.value = h
}

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
  <Tabs v-model="mobileTab" class="flex flex-col gap-0 pb-6">
    <ToolPageHeader
      title="条形码批量生成"
      description="按换行或逗号批量输入 ASCII 编码，按毫米尺寸在 A4 纸张自动网格排版并导出。"
      badge="CODE128"
      :icon="Barcode"
    >
      <template #actions>
        <Button type="button" variant="secondary" size="sm" @click="input = SAMPLE_BARCODES">
          <Sparkles class="size-4" />
          填入示例
        </Button>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="sm">
              <Info class="size-4" />
              打印说明
            </Button>
          </TooltipTrigger>
          <TooltipContent
            class="max-w-72 flex-col items-start gap-1 py-2 text-[12px] leading-5 font-normal"
          >
            <p>按换行或中英文逗号分隔，仅支持标准 ASCII 字符。</p>
            <p>
              条码尺寸包含文字与留白。A4 页边距 10 mm，间距 5 mm，自动分页且不缩放；打印时请选择
              100% 实际大小。
            </p>
            <p>PDF 合并为多页文件；JPG（300 DPI）与 SVG 每页独立导出。</p>
          </TooltipContent>
        </Tooltip>

        <TabsList class="md:hidden">
          <TabsTrigger value="edit">编辑</TabsTrigger>
          <TabsTrigger value="preview">
            预览{{ sheets.length ? ` (${sheets.length})` : '' }}
          </TabsTrigger>
        </TabsList>
      </template>
    </ToolPageHeader>

    <div
      class="grid gap-5 md:h-[calc(100dvh-11.5rem)] md:min-h-[31rem] md:grid-cols-[minmax(20rem,1fr)_minmax(0,1.45fr)]"
    >
      <!-- Edit Panel -->
      <TabsContent
        value="edit"
        force-mount
        class="mt-0 flex min-h-0 min-w-0 flex-col data-[state=inactive]:hidden md:data-[state=inactive]:flex"
      >
        <Card class="min-h-0 flex-1">
          <CardContent class="flex min-h-0 flex-1 flex-col gap-3.5 px-4 py-4">
            <div class="flex min-h-44 flex-1 flex-col gap-2 md:min-h-0">
              <div class="flex shrink-0 items-center justify-between gap-2">
                <Label for="barcode-contents">条码内容列表</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  class="min-h-7 px-2 text-[12px]"
                  :disabled="!input"
                  @click="input = ''"
                >
                  <Eraser class="size-3.5" />
                  清空
                </Button>
              </div>
              <Textarea
                id="barcode-contents"
                v-model="input"
                class="min-h-40 flex-1 resize-none field-sizing-fixed font-mono text-[14px] leading-6 md:min-h-0"
                placeholder="按换行或逗号分隔，例如：&#10;ABC123，ITEM-001&#10;1234567890"
                spellcheck="false"
              />
            </div>

            <div class="shrink-0 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-1.5">
                <span class="text-[12px] text-ink-muted">快捷尺寸 (mm)</span>
                <div class="flex flex-wrap gap-1">
                  <Button
                    v-for="preset in SIZE_PRESETS"
                    :key="preset.label"
                    type="button"
                    size="sm"
                    :variant="
                      Number(width) === preset.w && Number(height) === preset.h
                        ? 'primary'
                        : 'secondary'
                    "
                    class="min-h-6 rounded-full px-2.5 font-mono text-[11px]"
                    @click="applySizePreset(preset.w, preset.h)"
                  >
                    {{ preset.label }}
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2.5">
                <div class="space-y-1.5">
                  <Label for="barcode-width">宽度 mm</Label>
                  <Input
                    id="barcode-width"
                    v-model="width"
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    :invalid="!validSize"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label for="barcode-height">高度 mm</Label>
                  <Input
                    id="barcode-height"
                    v-model="height"
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    :invalid="!validSize"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label for="barcode-format">导出格式</Label>
                  <Select
                    :model-value="format"
                    :disabled="exporting"
                    @update:model-value="
                      (v) => {
                        if (v) format = v as BarcodeExportFormat
                      }
                    "
                  >
                    <SelectTrigger id="barcode-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                      <SelectItem value="svg">SVG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div
              class="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-ink-muted"
              aria-live="polite"
            >
              <span>
                有效 <strong class="text-ink">{{ validBarcodes.length }}</strong> 条
                <span v-if="barcodes.length > validBarcodes.length" class="text-danger">
                  · 无效 {{ barcodes.length - validBarcodes.length }} 条
                </span>
              </span>
              <Badge v-if="sheetLayout.layout" variant="outline" class="font-mono tabular-nums">
                {{ sheetLayout.layout.columns }}×{{ sheetLayout.layout.rows }} / 页 · 共
                {{ sheets.length }} 页
              </Badge>
            </div>

            <p v-if="errorMessage" class="shrink-0 text-[12px] text-danger" role="alert">
              {{ errorMessage }}
            </p>

            <div v-if="barcodes.length" class="flex shrink-0 gap-2">
              <Select
                :model-value="selected"
                @update:model-value="
                  (v) => {
                    if (v) selected = v
                  }
                "
              >
                <SelectTrigger class="min-w-0 flex-1" aria-label="选择单个条码">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(barcode, index) in barcodes"
                    :key="index"
                    :value="String(index)"
                  >
                    {{ index + 1 }}. {{ barcode.content }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="secondary"
                class="shrink-0"
                :disabled="!selectedBarcode || !!selectedBarcode.error || !validSize || exporting"
                @click="selectedBarcode && exportBarcodes([selectedBarcode], Number(selected))"
              >
                导出单个
              </Button>
            </div>

            <Button
              class="w-full shrink-0"
              :disabled="!sheets.length || exporting"
              :loading="exporting"
              @click="exportBarcodes(validBarcodes)"
            >
              <Download class="size-4" />
              {{ exporting ? '正在导出…' : `导出 A4 排版 (${format.toUpperCase()})` }}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Preview Panel -->
      <TabsContent
        value="preview"
        force-mount
        class="mt-0 flex min-h-[26rem] min-w-0 flex-col data-[state=inactive]:hidden md:min-h-0 md:data-[state=inactive]:flex"
      >
        <BarcodeSheetPreview :sheets="sheets" />
      </TabsContent>
    </div>
  </Tabs>
</template>
