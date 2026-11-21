<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  FileEdit,
  FilePlus2,
  FileText,
  Grid,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Wand2,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnswerSheetListItem, GroupReviewStatus } from '@/lib/answer-sheet/draft'
import { BLOCK_TYPE_LABELS, SUBJECT_LABELS } from '@/lib/answer-sheet/preview'
import type { QuestionGroup } from '@/lib/answer-sheet/review'
import type { AnswerSheetBlock, BlockType, ValidationIssue } from '@/lib/answer-sheet/types'
import { useAnswerSheetStore } from '@/stores/answerSheet'

const emit = defineEmits<{
  createNewSheet: [file?: File]
  locateBlock: [blockId: string]
  reviewGroup: [groupId: string]
  repairGroup: [groupId: string]
}>()

const store = useAnswerSheetStore()
const leftTab = ref<'outline' | 'reviews'>('outline')
const draggingBlockId = ref<string | null>(null)
const dragOverBlockId = ref<string | null>(null)
const newSheetFileInputRef = ref<HTMLInputElement>()

function handleNewSheetFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('createNewSheet', file)
  }
  input.value = ''
}

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp) return '刚刚'
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function handleSelectSheet(item: AnswerSheetListItem) {
  if (item.sheetId === store.sheetId && store.semanticData) return
  await store.selectAnswerSheet(item.sheetId)
}

const blockTypeIcons: Record<BlockType, Component> = {
  omr_choice: CheckSquare,
  compact_blank: Layers,
  mixed_inline: FileEdit,
  open_blank_box: Square,
  lined_writing: FileEdit,
  composition_grid: Grid,
  drawing_grid: ImageIcon,
}

const validationIssues = computed(() => {
  if (!store.semanticData) return []
  return store.semanticData.validation.issues.map((issue, idx) => ({
    issue,
    key: `${issue.code}:${issue.relatedBlockId ?? idx}`,
    resolved: store.resolvedIssueKeySet.has(`${issue.code}:${issue.relatedBlockId ?? idx}`),
  }))
})

const objectiveBlocks = computed(() =>
  (store.semanticData?.blocks ?? [])
    .filter((b) => b.type === 'omr_choice')
    .sort((a, b) => a.numericOrder - b.numericOrder),
)

const subjectiveBlocks = computed(() =>
  (store.semanticData?.blocks ?? [])
    .filter((b) => b.type !== 'omr_choice')
    .sort((a, b) => a.numericOrder - b.numericOrder),
)

const statusBadgeMap: Record<
  GroupReviewStatus,
  { label: string; variant: 'neutral' | 'accent' | 'accent-alt' | 'outline' }
> = {
  pending: { label: '待审', variant: 'outline' },
  reviewing: { label: '复审中', variant: 'neutral' },
  passed: { label: '通过', variant: 'accent' },
  needs_revision: { label: '待修', variant: 'accent-alt' },
  manual_review: { label: '待人工核对', variant: 'accent-alt' },
}

function handleIssueClick(issue: ValidationIssue) {
  if (issue.relatedBlockId) {
    store.selectBlock(issue.relatedBlockId)
    emit('locateBlock', issue.relatedBlockId)
  }
}

function handleBlockClick(block: AnswerSheetBlock) {
  store.selectBlock(block.id)
  emit('locateBlock', block.id)
}

function handleAddBlock(type: BlockType) {
  const newId = store.addBlock(type, store.selectedBlockId ?? undefined)
  if (newId) {
    emit('locateBlock', newId)
  }
}

function onDragStart(blockId: string) {
  draggingBlockId.value = blockId
}

function onDragOver(blockId: string) {
  if (draggingBlockId.value && draggingBlockId.value !== blockId) {
    dragOverBlockId.value = blockId
  }
}

function onDrop(targetBlockId: string) {
  if (draggingBlockId.value && draggingBlockId.value !== targetBlockId) {
    store.reorderSubjectiveBlocks(draggingBlockId.value, targetBlockId)
  }
  draggingBlockId.value = null
  dragOverBlockId.value = null
}

function onDragEnd() {
  draggingBlockId.value = null
  dragOverBlockId.value = null
}

function selectGroupAndLocate(group: QuestionGroup, targetBlockId?: string) {
  store.activeGroupId = group.groupId
  const bid = targetBlockId ?? group.blockIds[0]
  if (bid) {
    store.selectBlock(bid)
    emit('locateBlock', bid)
  }
}
</script>

<template>
  <aside
    class="flex h-full min-h-0 flex-col border-r border-line bg-raised"
    aria-label="大纲与质检面板"
    data-sheet-screen-only
  >
    <!-- 0. Local Answer Sheet List Section -->
    <section class="shrink-0 border-b border-line p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <FileText class="size-4 text-ink-muted" />
          <h2 class="text-xs font-semibold text-ink">答题卡列表</h2>
          <Badge variant="neutral" class="px-1.5 font-mono text-[10px]">
            {{ store.sheetList.length }}
          </Badge>
        </div>

        <input
          ref="newSheetFileInputRef"
          type="file"
          accept=".docx,.pdf,image/png,image/jpeg,image/webp"
          class="hidden"
          @change="handleNewSheetFileChange"
        />
        <Button
          variant="primary"
          size="sm"
          class="h-7 px-2 text-xs"
          :disabled="store.isParsing"
          @click="newSheetFileInputRef?.click()"
        >
          <template #leading><FilePlus2 class="size-3.5" /></template>
          新建答题卡
        </Button>
      </div>

      <div
        v-if="store.sheetList.length === 0"
        class="rounded-control border border-dashed border-line bg-surface px-3 py-3 text-center text-xs text-ink-muted"
      >
        暂无本地答题卡，请点击右上角「新建答题卡」并选择试卷文件。
      </div>

      <ul v-else class="max-h-40 space-y-1.5 overflow-y-auto" aria-label="本地答题卡列表">
        <li
          v-for="sheet in store.sheetList"
          :key="sheet.sheetId"
          class="group flex cursor-pointer items-center justify-between gap-2 rounded-control border px-2.5 py-2 text-xs transition-colors"
          :class="
            sheet.sheetId === store.sheetId
              ? 'border-ink bg-control text-ink'
              : 'border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink'
          "
          @click="handleSelectSheet(sheet)"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-1.5">
              <span class="truncate font-semibold text-ink">{{ sheet.title }}</span>
              <Badge v-if="sheet.subject" variant="outline" class="shrink-0 px-1 py-0 text-[10px]">
                {{ SUBJECT_LABELS[sheet.subject] }}
              </Badge>
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-ink-muted">
              <span v-if="sheet.hasSemanticData"
                >{{ sheet.blockCount }} 题 · {{ sheet.totalScore }} 分</span
              >
              <span
                v-else-if="store.isParsing && sheet.sheetId === store.sheetId"
                class="text-accent"
              >
                正在解析试卷...
              </span>
              <span v-else class="text-accent-alt">待解析试卷</span>
              <span>·</span>
              <span>{{ formatUpdatedAt(sheet.updatedAt) }}</span>
            </div>
          </div>

          <button
            type="button"
            title="删除该答题卡"
            :aria-label="`删除答题卡 ${sheet.title}`"
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] text-ink-muted opacity-0 transition-opacity hover:bg-surface hover:text-danger group-hover:opacity-100"
            @click.stop="store.deleteAnswerSheet(sheet.sheetId)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </li>
      </ul>
    </section>

    <!-- 1. Pinned Top Validation Alert Zone -->
    <section v-if="store.semanticData" class="shrink-0 border-b border-line p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <AlertTriangle
            v-if="validationIssues.some((i) => !i.resolved)"
            class="size-4 text-accent-alt"
          />
          <CheckCircle2 v-else class="size-4 text-accent" />
          <h2 class="text-xs font-semibold text-ink">质检与总分核查</h2>
        </div>
        <Badge
          v-if="store.semanticData"
          variant="outline"
          class="font-mono text-[11px] tabular-nums"
        >
          {{ store.semanticData.validation.calculatedScore }} /
          {{ store.semanticData.meta.totalScore }} 分
        </Badge>
      </div>

      <div
        v-if="validationIssues.length === 0"
        class="rounded-control border border-line bg-surface px-2.5 py-2 text-[11px] text-ink-muted"
      >
        题号连续、分值守恒，未检测到异常。
      </div>

      <ul v-else class="max-h-36 space-y-1.5 overflow-y-auto">
        <li
          v-for="item in validationIssues"
          :key="item.key"
          class="flex flex-col gap-1.5 rounded-control border px-2.5 py-2 text-xs transition-opacity"
          :class="[
            item.issue.severity === 'error'
              ? 'border-danger/50 bg-danger/10 text-danger'
              : 'border-accent-alt/50 bg-accent-alt/10 text-ink',
            item.resolved ? 'opacity-50' : '',
          ]"
        >
          <div
            class="flex cursor-pointer items-start gap-1.5"
            role="button"
            tabindex="0"
            @click="handleIssueClick(item.issue)"
            @keydown.enter.prevent="handleIssueClick(item.issue)"
          >
            <AlertCircle
              class="mt-0.5 size-3.5 shrink-0"
              :class="item.issue.severity === 'error' ? 'text-danger' : 'text-accent-alt'"
            />
            <span
              class="flex-1 text-[11px] leading-snug"
              :class="{ 'line-through': item.resolved }"
            >
              {{ item.issue.message }}
            </span>
          </div>
          <div class="flex items-center justify-end gap-1.5">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-[5px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted hover:text-ink"
              @click.stop="store.toggleIssueResolved(item.key)"
            >
              <Check class="size-2.5" />
              {{ item.resolved ? '取消核对' : '标记已核对' }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 2. Tabs: Question Structure Outline Tree vs Per-Group AI Review -->
    <Tabs v-if="store.semanticData" v-model="leftTab" class="flex min-h-0 flex-1 flex-col p-3">
      <div class="mb-2 flex items-center justify-between gap-1.5">
        <TabsList class="grid flex-1 grid-cols-2">
          <TabsTrigger value="outline" class="text-xs">题目结构树</TabsTrigger>
          <TabsTrigger value="reviews" class="text-xs">
            逐大题复审
            <Badge
              v-if="store.unpassedQuestionGroups.length > 0"
              variant="accent-alt"
              class="ml-1 h-4 px-1 text-[10px]"
            >
              {{ store.unpassedQuestionGroups.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="sm" class="h-7 px-2 text-xs" title="添加遗漏题目">
              <Plus class="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuLabel>快速添加遗漏题目</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="(label, typeKey) in BLOCK_TYPE_LABELS"
              :key="typeKey"
              @select="handleAddBlock(typeKey)"
            >
              {{ label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Outline Tree -->
      <TabsContent value="outline" class="min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-3">
          <!-- Objective Questions Group -->
          <div v-if="objectiveBlocks.length > 0" class="space-y-1">
            <div
              class="flex items-center justify-between px-1 text-[11px] font-semibold text-ink-muted"
            >
              <span>客观选择题组 ({{ objectiveBlocks.length }} 题)</span>
              <span>
                {{ Math.round(objectiveBlocks.reduce((s, b) => s + (b.score ?? 0), 0) * 10) / 10 }}
                分
              </span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <div
                v-for="block in objectiveBlocks"
                :key="block.id"
                class="group relative flex cursor-pointer items-center justify-between rounded-control border px-2 py-1 text-xs transition-colors"
                :class="
                  store.selectedBlockId === block.id
                    ? 'border-ink bg-control font-semibold text-ink'
                    : 'border-line bg-surface text-ink-muted hover:border-ink-muted hover:text-ink'
                "
                @click="handleBlockClick(block)"
              >
                <span class="truncate">{{ block.displayNo }}</span>
                <span class="font-mono text-[10px] opacity-75">{{ block.options.length }}选</span>
                <button
                  type="button"
                  aria-label="删除误识别题目"
                  class="hidden text-ink-muted hover:text-danger group-hover:inline-flex"
                  @click.stop="store.deleteBlock(block.id)"
                >
                  <Trash2 class="size-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Subjective Questions (Draggable reorder) -->
          <div class="space-y-1">
            <div
              class="flex items-center justify-between px-1 text-[11px] font-semibold text-ink-muted"
            >
              <span>非客观题（支持拖拽排序）</span>
              <span>{{ subjectiveBlocks.length }} 题</span>
            </div>

            <ul class="space-y-1">
              <li
                v-for="block in subjectiveBlocks"
                :key="block.id"
                draggable="true"
                class="group flex cursor-pointer items-center justify-between gap-1.5 rounded-control border px-2 py-1.5 text-xs transition-colors"
                :class="[
                  store.selectedBlockId === block.id
                    ? 'border-ink bg-control font-semibold text-ink'
                    : 'border-line bg-surface text-ink hover:bg-control/60',
                  dragOverBlockId === block.id ? 'border-accent ring-1 ring-accent' : '',
                ]"
                @click="handleBlockClick(block)"
                @dragstart="onDragStart(block.id)"
                @dragover.prevent="onDragOver(block.id)"
                @drop.prevent="onDrop(block.id)"
                @dragend="onDragEnd"
              >
                <div class="flex min-w-0 items-center gap-1.5">
                  <GripVertical
                    class="size-3.5 shrink-0 cursor-grab text-ink-faint group-hover:text-ink-muted"
                  />
                  <component
                    :is="blockTypeIcons[block.type]"
                    class="size-3.5 shrink-0 text-ink-muted"
                  />
                  <span class="font-medium">第 {{ block.displayNo }} 题</span>
                  <span class="truncate text-[11px] text-ink-muted">
                    {{ BLOCK_TYPE_LABELS[block.type] }}
                  </span>
                </div>

                <div class="flex shrink-0 items-center gap-1">
                  <Badge variant="neutral" class="px-1.5 font-mono text-[10px]">
                    {{ block.score ?? 0 }}分
                  </Badge>
                  <button
                    type="button"
                    title="删除该题"
                    aria-label="删除误识别题目"
                    class="inline-flex size-5 items-center justify-center rounded-[4px] text-ink-muted opacity-0 transition-opacity hover:bg-surface hover:text-danger group-hover:opacity-100"
                    @click.stop="store.deleteBlock(block.id)"
                  >
                    <Trash2 class="size-3" />
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </TabsContent>

      <!-- Per-Question Group AI Review Loop -->
      <TabsContent value="reviews" class="min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-2">
          <div
            v-for="group in store.questionGroups"
            :key="group.groupId"
            class="space-y-2 rounded-control border p-2.5 text-xs transition-colors"
            :class="
              store.activeGroupId === group.groupId
                ? 'border-ink bg-control/50'
                : 'border-line bg-surface'
            "
            @click="selectGroupAndLocate(group)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-ink">{{ group.displayNo }}</span>
              <Badge
                :variant="statusBadgeMap[store.getGroupReviewState(group).status].variant"
                class="text-[10px]"
              >
                <Loader2
                  v-if="store.getGroupReviewState(group).status === 'reviewing'"
                  class="mr-1 size-2.5 animate-spin"
                />
                {{ statusBadgeMap[store.getGroupReviewState(group).status].label }}
              </Badge>
            </div>

            <!-- Review Issues List (AI evidence, actual mm dimensions, suggestion) -->
            <div
              v-if="store.getGroupReviewState(group).latestResult?.issues.length"
              class="space-y-1.5"
            >
              <div
                v-for="(issue, idx) in store.getGroupReviewState(group).latestResult!.issues"
                :key="idx"
                class="cursor-pointer space-y-1 rounded-[8px] border border-line bg-raised p-2 text-[11px]"
                @click.stop="selectGroupAndLocate(group, issue.blockId)"
              >
                <div class="flex items-center justify-between">
                  <Badge variant="outline" class="text-[10px]">
                    {{ issue.kind === 'layout' ? '版式空间复审' : '语义结构复审' }}
                    <template v-if="issue.subNo"> · {{ issue.subNo }}</template>
                  </Badge>
                  <span class="text-[10px] text-accent">点击定位题块</span>
                </div>
                <p class="text-ink"><strong>判断依据与实际尺寸：</strong>{{ issue.evidence }}</p>
                <p class="text-ink-muted"><strong>建议：</strong>{{ issue.suggestion }}</p>
              </div>
            </div>

            <p
              v-else-if="store.getGroupReviewState(group).status === 'passed'"
              class="text-[11px] text-ink-muted"
            >
              作答空间与题目结构复审通过。
            </p>
            <p
              v-else-if="store.getGroupReviewState(group).status === 'pending'"
              class="text-[11px] text-ink-muted"
            >
              内容或高度已变更，点击「发起复审」检验当前版式尺寸。
            </p>
            <p
              v-else-if="store.getGroupReviewState(group).status === 'manual_review'"
              class="text-[11px] text-accent-alt"
            >
              已超过两轮自动返修或结果不确定，请人工核对确认。
            </p>

            <!-- Group Review Actions -->
            <div class="flex flex-wrap items-center justify-end gap-1.5 pt-1">
              <Button
                size="sm"
                variant="secondary"
                class="h-6 px-2 text-[11px]"
                :disabled="store.getGroupReviewState(group).status === 'reviewing'"
                @click.stop="emit('reviewGroup', group.groupId)"
              >
                <RefreshCw class="mr-1 size-3" />
                发起复审
              </Button>
              <Button
                v-if="
                  store.getGroupReviewState(group).status === 'needs_revision' &&
                  store.getGroupReviewState(group).automaticRepairCount < 2
                "
                size="sm"
                variant="primary"
                class="h-6 px-2 text-[11px]"
                @click.stop="emit('repairGroup', group.groupId)"
              >
                <Wand2 class="mr-1 size-3" />
                自动返修 ({{ store.getGroupReviewState(group).automaticRepairCount }}/2)
              </Button>
              <Button
                v-if="store.getGroupReviewState(group).status !== 'passed'"
                size="sm"
                variant="ghost"
                class="h-6 px-2 text-[11px]"
                @click.stop="store.markGroupManualVerified(group.groupId)"
              >
                <Check class="mr-1 size-3" />
                人工确认通过
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </aside>
</template>
