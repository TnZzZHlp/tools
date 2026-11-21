<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, CheckCircle2, Printer } from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { GroupReviewStatus } from '@/lib/answer-sheet/draft'
import type { PaginatedSheetModel } from '@/lib/answer-sheet/layout/model'
import type { PaperProfile } from '@/lib/answer-sheet/paper'
import { printAnswerSheet } from '@/lib/answer-sheet/print'
import type { QuestionGroup } from '@/lib/answer-sheet/review'

export interface UnpassedGroupItem {
  group: QuestionGroup
  review: {
    status: GroupReviewStatus
    revision: string
    automaticRepairCount: number
  }
}

const props = withDefaults(
  defineProps<{
    root?: HTMLElement
    layout?: PaginatedSheetModel
    disabled: boolean
    paper: PaperProfile
    unpassedGroups?: UnpassedGroupItem[]
  }>(),
  {
    unpassedGroups: () => [],
  },
)

const open = ref(false)
const printing = ref(false)
const printError = ref(false)
const warningConfirmed = ref(false)

const hasUnpassedWarning = computed(() => props.unpassedGroups.length > 0)

const statusLabels: Record<GroupReviewStatus, string> = {
  pending: '待复审',
  reviewing: '复审中',
  passed: '已通过',
  needs_revision: '待修订',
  manual_review: '待人工核对',
}

function openPrint() {
  printError.value = false
  warningConfirmed.value = false
  open.value = true
}

async function confirmPrint() {
  const root = props.root
  const layout = props.layout
  const paper = props.paper
  if (!root || !layout || props.disabled || printing.value) return
  if (hasUnpassedWarning.value && !warningConfirmed.value) {
    warningConfirmed.value = true
    return
  }
  printing.value = true
  printError.value = false
  try {
    if (
      await printAnswerSheet(
        root,
        () => !props.disabled && props.layout === layout && props.paper === paper && open.value,
      )
    )
      open.value = false
  } catch {
    printError.value = true
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <Button size="sm" :disabled="disabled" @click="openPrint">
    <template #leading><Printer class="size-4" /></template>
    打印 / 另存 PDF
  </Button>
  <Dialog v-model:open="open">
    <DialogContent class="w-[min(32rem,calc(100vw-2rem))] space-y-4">
      <div class="space-y-1.5">
        <DialogTitle>打印答题卡 / 另存矢量 PDF</DialogTitle>
        <DialogDescription>
          在浏览器打印对话框中选择
          <strong class="text-ink">{{ paper.widthMm }} × {{ paper.heightMm }} mm</strong>
          纸张，缩放设为<strong class="text-ink">实际大小（100%）</strong
          >，关闭页眉和页脚。也可将目标打印机设为「另存为 PDF」。正式打印不含任何复审尺寸标注。
        </DialogDescription>
      </div>

      <p v-if="paper.id.startsWith('8K')" class="text-xs text-ink-muted">
        未列出正度 8 开纸时，可在打印机驱动中添加自定义纸张尺寸（{{ paper.widthMm }} ×
        {{ paper.heightMm }} mm）。
      </p>

      <Alert v-if="hasUnpassedWarning" variant="danger">
        <template #icon>
          <AlertTriangle class="size-4" />
        </template>
        <AlertTitle>存在 {{ unpassedGroups.length }} 道未通过或未复审的大题</AlertTitle>
        <AlertDescription>
          <p class="mb-2 text-xs">以下大题尚未通过 AI 空间与语义复审，建议核对无误后再继续打印：</p>
          <ul class="max-h-36 space-y-1 overflow-y-auto pr-1 text-xs">
            <li
              v-for="item in unpassedGroups"
              :key="item.group.groupId"
              class="flex items-center justify-between gap-2 rounded-[6px] bg-surface/70 px-2 py-1"
            >
              <span class="truncate font-medium text-ink">{{ item.group.displayNo }}</span>
              <Badge
                :variant="item.review.status === 'needs_revision' ? 'accent-alt' : 'outline'"
                class="shrink-0 text-[11px]"
              >
                {{ statusLabels[item.review.status] }}
              </Badge>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <div
        v-else
        class="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-xs text-accent"
      >
        <CheckCircle2 class="size-4 shrink-0" />
        <span>全卷所有大题均已通过复审，可直接打印或导出矢量 PDF。</span>
      </div>

      <p v-if="printError" role="alert" class="text-sm text-danger">
        无法打印，请检查配图是否加载成功后重试。
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" @click="open = false">取消</Button>
        <Button
          :variant="hasUnpassedWarning && !warningConfirmed ? 'danger' : 'primary'"
          size="sm"
          :disabled="disabled || printing"
          :loading="printing"
          @click="confirmPrint"
        >
          {{ hasUnpassedWarning && !warningConfirmed ? '确认风险并继续打印' : '打开打印对话框' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
