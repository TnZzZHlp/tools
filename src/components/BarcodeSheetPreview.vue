<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Barcode, ChevronLeft, ChevronRight } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const props = defineProps<{ sheets: string[] }>()
const page = ref(0)
const currentSheet = computed(() => props.sheets[page.value])

watch(
  () => props.sheets.length,
  (length) => {
    page.value = Math.max(0, Math.min(page.value, length - 1))
  },
)
</script>

<template>
  <Card class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 py-4" aria-label="A4 条码预览">
    <CardHeader class="px-4">
      <div class="flex items-center justify-between gap-2">
        <CardTitle class="text-sm font-semibold sm:text-base">A4 纸张排版预览</CardTitle>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            class="size-7"
            :disabled="page === 0"
            aria-label="上一页"
            @click="page--"
          >
            <ChevronLeft class="size-4" />
          </Button>
          <span
            class="min-w-16 text-center text-xs tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {{ sheets.length ? page + 1 : 0 }} / {{ sheets.length }} 页
          </span>
          <Button
            variant="outline"
            size="icon"
            class="size-7"
            :disabled="page >= sheets.length - 1"
            aria-label="下一页"
            @click="page++"
          >
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex min-h-0 flex-1 flex-col px-4">
      <div
        class="relative min-h-72 flex-1 overflow-hidden rounded-lg border bg-muted/35 md:min-h-0"
      >
        <img
          v-if="currentSheet"
          :src="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentSheet)}`"
          :alt="`A4 第 ${page + 1} 页条码排版预览`"
          class="absolute inset-0 h-full w-full object-contain p-3 sm:p-4"
        />
        <div
          v-else
          class="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6 text-center text-muted-foreground"
        >
          <div class="flex size-12 items-center justify-center rounded-full border bg-background">
            <Barcode class="size-6" aria-hidden="true" />
          </div>
          <p class="text-sm font-medium text-foreground">暂无条码预览</p>
          <p class="max-w-xs text-xs leading-relaxed">
            在左侧输入条码内容（或点击顶部“填入示例”），将实时生成 A4 打印预览。
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
