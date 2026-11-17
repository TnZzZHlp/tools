<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Barcode, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

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
  <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-2" aria-label="A4 条码预览">
    <div class="flex h-8 shrink-0 items-center justify-between gap-2">
      <span class="text-sm font-medium">A4 预览</span>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          :disabled="page === 0"
          aria-label="上一页"
          @click="page--"
        >
          <ChevronLeft class="size-4" />
        </Button>
        <span
          class="min-w-16 text-center text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
          >{{ sheets.length ? page + 1 : 0 }} / {{ sheets.length }} 页</span
        >
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          :disabled="page >= sheets.length - 1"
          aria-label="下一页"
          @click="page++"
        >
          <ChevronRight class="size-4" />
        </Button>
      </div>
    </div>
    <div class="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
      <img
        v-if="currentSheet"
        :src="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentSheet)}`"
        :alt="`A4 第 ${page + 1} 页条码排版预览`"
        class="absolute inset-0 h-full w-full object-contain p-2 sm:p-3"
      />
      <div
        v-else
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <Barcode class="size-10" aria-hidden="true" />
        <p class="text-sm">输入有效内容后预览条码</p>
      </div>
    </div>
  </section>
</template>
