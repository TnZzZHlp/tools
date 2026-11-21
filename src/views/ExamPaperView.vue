<script setup lang="ts">
import { onMounted, provide, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileSpreadsheet,
  Info,
  ListTree,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Undo2,
  Upload,
} from 'lucide-vue-next'

import ExamFocusedEditor from '@/components/exam-paper/ExamFocusedEditor.vue'
import ExamImportDialog from '@/components/exam-paper/ExamImportDialog.vue'
import ExamOutlineSidebar from '@/components/exam-paper/ExamOutlineSidebar.vue'
import ExamPaperPreview from '@/components/exam-paper/ExamPaperPreview.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useToast } from '@/components/ui/toast'
import {
  createExamPaperEditor,
  examPaperContextKey,
  type AdvancedFieldKey,
} from '@/composables/useExamPaperEditor'
import { useTheme } from '@/composables/useTheme'
import { downloadDocxFile, sanitizeFilename } from '@/lib/exam-paper/docxBuilder'
import { serializeExamJson } from '@/lib/exam-paper/parser'
import { formatScore, type ValidationIssue } from '@/lib/exam-paper/render'
import type { ExamDocument } from '@/lib/exam-paper/types'

function tryUseToast() {
  try {
    return useToast()
  } catch {
    return null
  }
}

function tryUseTheme(): boolean {
  try {
    useTheme()
    return true
  } catch {
    return false
  }
}

const toastApi = tryUseToast()
const hasThemeProvider = tryUseTheme()
const themeLabels = {
  system: '跟随系统',
  light: '浅色模式',
  dark: '深色模式',
} as const
const editor = createExamPaperEditor()
provide(examPaperContextKey, editor)

const mobileTab = ref<'edit' | 'preview'>('edit')
const outlineSheetOpen = ref(false)
const importDialogOpen = ref(false)
const specDialogOpen = ref(false)
const issuesPopoverOpen = ref(false)
const advancedPopoverOpen = ref(false)
const showPreview = ref(true)
const exporting = ref(false)

const ADVANCED_FIELD_ITEMS: Array<{
  key: AdvancedFieldKey
  id: string
  label: string
  description: string
}> = [
  {
    key: 'answer',
    id: 'advanced-field-answer',
    label: '【答案】',
    description: '题目与子题答案输入及选项快选',
  },
  {
    key: 'difficulty',
    id: 'advanced-field-difficulty',
    label: '【难度】',
    description: '容易至困难五档难度选择',
  },
  {
    key: 'knowledge',
    id: 'advanced-field-knowledge',
    label: '【知识点】',
    description: '知识点标签输入与同卷复用',
  },
  {
    key: 'analysis',
    id: 'advanced-field-analysis',
    label: '【解析】',
    description: '题目解析与解题步骤编辑',
  },
]

onMounted(() => {
  document.title = '试卷模板 · Tools'
})

function notify(
  title: string,
  description?: string,
  variant: 'default' | 'success' | 'danger' = 'default',
) {
  toastApi?.toast({ title, description, variant })
}

function handleUndo() {
  if (editor.undo()) {
    notify('已撤销上一步结构变更')
  }
}

function handleLoadPreset(kind: 'sample' | 'empty' | 'skeleton') {
  editor.loadPresetDocument(kind)
  if (kind === 'sample') {
    notify('已填入示例试卷', '包含选择题、子母题、阅读理解题组、填空题与解答题示例。', 'success')
  } else if (kind === 'skeleton') {
    notify('已载入标准综合卷骨架', '包含 5 道选择题、3 道填空题与 2 道解答题空模板。', 'success')
  } else {
    notify('已新建空白试卷', '可直接在聚焦编辑区输入试题。')
  }
}

function handleImportApply(imported: ExamDocument, mode: 'replace' | 'append') {
  editor.applyImport(imported, mode)
  if (mode === 'replace') {
    notify('已导入并替换试卷', `共导入 ${imported.sections.length} 个大题。`, 'success')
  } else {
    notify('已追加大题', `向当前试卷追加了 ${imported.sections.length} 个大题。`, 'success')
  }
}

function handleExportDocx() {
  if (exporting.value) return
  if (editor.errorIssues.value.length > 0) {
    issuesPopoverOpen.value = true
    notify(
      '请先修正模板错误',
      editor.errorIssues.value[0]?.message ?? '存在必填项缺失。',
      'danger',
    )
    return
  }

  exporting.value = true
  try {
    const filename = downloadDocxFile(editor.doc.value)
    notify('Word 试卷已生成', `已下载 ${filename}`, 'success')
  } catch (err) {
    notify(
      '导出失败',
      err instanceof Error ? err.message : '生成 .docx 文件时发生错误。',
      'danger',
    )
  } finally {
    exporting.value = false
  }
}

function handleExportJson() {
  const json = serializeExamJson(editor.doc.value)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(editor.doc.value.title)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  notify('已导出 JSON 数据', '可用于备份或二次导入编辑。')
}

function handleIssueClick(issue: ValidationIssue) {
  editor.jumpToIssue(issue)
  issuesPopoverOpen.value = false
  mobileTab.value = 'edit'
}

function handlePreviewSelect(payload: { sectionId?: string; itemId?: string; childId?: string }) {
  if (payload.sectionId && payload.itemId) {
    editor.selectItem(payload.sectionId, payload.itemId, payload.childId)
  } else if (payload.sectionId) {
    editor.selectSection(payload.sectionId)
  }
}
</script>

<template>
  <div
    class="flex min-h-[100dvh] w-full flex-col bg-surface text-ink lg:h-[100dvh] lg:overflow-hidden"
  >
    <!-- Top Compact Workspace Bar -->
    <header
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2 sm:px-4"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <RouterLink
          to="/"
          aria-label="返回工具集首页"
          title="返回首页"
          class="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:bg-control hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
        >
          <ArrowLeft class="size-4" />
        </RouterLink>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="min-h-8 px-2.5 lg:hidden"
          aria-label="打开试卷大纲"
          @click="outlineSheetOpen = true"
        >
          <ListTree class="size-4" />
          目录
        </Button>

        <Input
          id="exam-title"
          :model-value="editor.doc.value.title"
          :invalid="!editor.doc.value.title.trim()"
          class="h-8 min-w-44 flex-1 text-[14px] font-semibold sm:max-w-sm lg:max-w-md"
          placeholder="请在此处输入试卷名称"
          aria-label="试卷名称"
          @update:model-value="(v) => editor.setTitle(String(v))"
        />

        <div class="hidden items-center gap-1.5 text-[12px] text-ink-muted md:flex">
          <Badge variant="outline" class="font-mono tabular-nums">
            {{ editor.stats.value.sectionCount }} 大题
          </Badge>
          <Badge variant="outline" class="font-mono tabular-nums">
            {{ editor.stats.value.questionCount }} 题
          </Badge>
          <Badge variant="outline" class="font-mono tabular-nums">
            {{ formatScore(editor.stats.value.totalScore) || '0' }} 分
          </Badge>
        </div>

        <Popover v-model:open="issuesPopoverOpen">
          <PopoverTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="min-h-8 gap-1.5 px-2 text-[12px]"
              :class="
                editor.errorIssues.value.length > 0
                  ? 'text-danger hover:text-danger'
                  : editor.warningIssues.value.length > 0
                    ? 'text-accent-alt hover:text-accent-alt'
                    : 'text-accent hover:text-accent'
              "
            >
              <AlertTriangle
                v-if="editor.errorIssues.value.length > 0 || editor.warningIssues.value.length > 0"
                class="size-3.5"
              />
              <CheckCircle2 v-else class="size-3.5" />
              <span v-if="editor.errorIssues.value.length > 0">
                {{ editor.errorIssues.value.length }} 处错误
              </span>
              <span v-else-if="editor.warningIssues.value.length > 0">
                {{ editor.warningIssues.value.length }} 项提示
              </span>
              <span v-else>符合模板规范</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-80 space-y-2 p-3">
            <p class="text-[12px] font-semibold text-ink">模板规范检查明细</p>
            <div v-if="editor.issues.value.length === 0" class="text-[12px] text-ink-muted">
              当前试卷结构、题组材料与标签均符合模板规范，可直接导出 Word 文档。
            </div>
            <ul v-else class="max-h-60 space-y-1 overflow-y-auto">
              <li v-for="(issue, idx) in editor.issues.value" :key="`${issue.code}-${idx}`">
                <button
                  type="button"
                  class="flex w-full items-start gap-1.5 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-surface"
                  @click="handleIssueClick(issue)"
                >
                  <span
                    class="mt-0.5 shrink-0 font-semibold"
                    :class="issue.severity === 'error' ? 'text-danger' : 'text-accent-alt'"
                  >
                    {{ issue.severity === 'error' ? '[错误]' : '[提示]' }}
                  </span>
                  <span class="text-ink">{{ issue.message }}</span>
                </button>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-1.5">
        <Tabs
          :model-value="mobileTab"
          class="xl:hidden"
          @update:model-value="
            (v) => {
              if (v === 'edit' || v === 'preview') mobileTab = v
            }
          "
        >
          <TabsList>
            <TabsTrigger value="edit">编辑</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          :disabled="!editor.canUndo.value"
          @click="handleUndo"
        >
          <Undo2 class="size-4" />
          <span class="hidden sm:inline">撤销</span>
        </Button>

        <Button type="button" variant="secondary" size="sm" @click="importDialogOpen = true">
          <Upload class="size-4" />
          导入
        </Button>

        <Popover v-model:open="advancedPopoverOpen">
          <PopoverTrigger as-child>
            <Button type="button" variant="secondary" size="sm">
              <SlidersHorizontal class="size-4" />
              <span>高级设置</span>
              <Badge
                v-if="editor.enabledAdvancedFieldCount.value > 0"
                variant="accent"
                class="h-4.5 px-1.5 font-mono text-[11px] tabular-nums"
              >
                {{ editor.enabledAdvancedFieldCount.value }}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-80 space-y-3 p-3.5">
            <div class="flex items-center justify-between gap-2">
              <p class="text-[13px] font-semibold text-ink">高级设置</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="min-h-6 px-2 text-[11px] text-ink-muted"
                @click="
                  editor.setAllAdvancedFields(
                    editor.enabledAdvancedFieldCount.value < ADVANCED_FIELD_ITEMS.length,
                  )
                "
              >
                {{
                  editor.enabledAdvancedFieldCount.value < ADVANCED_FIELD_ITEMS.length
                    ? '全部开启'
                    : '全部关闭'
                }}
              </Button>
            </div>
            <p class="text-[12px] text-ink-muted">
              开启后将在题目编辑区显示对应标签输入项，关闭不会清除已填内容。
            </p>
            <div class="space-y-2">
              <div
                v-for="item in ADVANCED_FIELD_ITEMS"
                :key="item.key"
                class="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2"
              >
                <label :for="item.id" class="min-w-0 flex-1 cursor-pointer">
                  <span class="block text-[12px] font-medium text-ink">{{ item.label }}</span>
                  <span class="block text-[11px] text-ink-muted">{{ item.description }}</span>
                </label>
                <Switch
                  :id="item.id"
                  :model-value="editor.advancedFields.value[item.key]"
                  @update:model-value="(val) => editor.setAdvancedField(item.key, Boolean(val))"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button type="button" variant="secondary" size="sm">
              <Settings2 class="size-4" />
              <span class="hidden sm:inline">模板</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>快速初始化试卷</DropdownMenuLabel>
            <DropdownMenuItem @select="handleLoadPreset('skeleton')">
              <FileSpreadsheet class="size-4 text-ink-muted" />
              <span>标准综合卷骨架</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="handleLoadPreset('sample')">
              <Sparkles class="size-4 text-ink-muted" />
              <span>载入完整示例</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="handleLoadPreset('empty')">
              <RotateCcw class="size-4 text-ink-muted" />
              <span>新建空白卷</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem @select="handleExportJson">
              <FileCode2 class="size-4 text-ink-muted" />
              <span>导出 JSON 备份</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="specDialogOpen = true">
              <Info class="size-4 text-ink-muted" />
              <span>模板规范说明</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="hidden xl:inline-flex"
          @click="showPreview = !showPreview"
        >
          <EyeOff v-if="showPreview" class="size-4" />
          <Eye v-else class="size-4" />
          {{ showPreview ? '隐藏预览' : '显示预览' }}
        </Button>

        <ThemeSwitcher v-if="hasThemeProvider" label="切换外观主题" :labels="themeLabels">
          <template #icon="{ theme }">
            <Sun v-if="theme === 'light'" class="size-4" aria-hidden="true" />
            <Moon v-else-if="theme === 'dark'" class="size-4" aria-hidden="true" />
            <Monitor v-else class="size-4" aria-hidden="true" />
          </template>
        </ThemeSwitcher>

        <Button
          type="button"
          variant="primary"
          size="sm"
          :disabled="exporting || editor.errorIssues.value.length > 0"
          :loading="exporting"
          @click="handleExportDocx"
        >
          <Download class="size-4" />
          导出 .docx
        </Button>
      </div>
    </header>

    <!-- 3-Zone Responsive Authoring Workbench -->
    <div
      class="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)]"
      :class="
        showPreview
          ? 'xl:grid-cols-[16.5rem_minmax(0,1.2fr)_minmax(24rem,0.9fr)] 2xl:grid-cols-[18rem_minmax(0,1.25fr)_minmax(28rem,0.95fr)]'
          : 'xl:grid-cols-[17.5rem_minmax(0,1fr)]'
      "
    >
      <!-- Zone 1: Desktop Outline Sidebar -->
      <div class="hidden min-h-0 flex-col lg:flex">
        <ExamOutlineSidebar />
      </div>

      <!-- Zone 2: Focused Single-Item Editor -->
      <div
        class="min-h-0 min-w-0 flex-col"
        :class="mobileTab === 'edit' ? 'flex' : 'hidden xl:flex'"
      >
        <ExamFocusedEditor />
      </div>

      <!-- Zone 3: Bidirectional Live Preview -->
      <div
        class="min-h-0 min-w-0 flex-col"
        :class="[
          mobileTab === 'preview' ? 'flex' : 'hidden',
          showPreview ? 'xl:flex' : 'xl:hidden',
        ]"
      >
        <ExamPaperPreview
          :doc="editor.doc.value"
          :error-count="editor.errorIssues.value.length"
          :warning-count="editor.warningIssues.value.length"
          :active-section-id="editor.activeSection.value?.id"
          :active-item-id="editor.activeItem.value?.id ?? null"
          :active-child-id="editor.activeGroupChild.value?.id ?? null"
          @select="handlePreviewSelect"
        />
      </div>
    </div>

    <!-- Mobile Outline Drawer -->
    <Sheet v-model:open="outlineSheetOpen">
      <SheetContent side="left" class="flex w-[min(21rem,90vw)] flex-col gap-3 p-4">
        <SheetHeader>
          <SheetTitle>试卷大纲目录</SheetTitle>
          <SheetDescription>选择大题或题目快速切换编辑位置</SheetDescription>
        </SheetHeader>
        <ExamOutlineSidebar @item-selected="outlineSheetOpen = false" />
      </SheetContent>
    </Sheet>

    <!-- Import Dialog -->
    <ExamImportDialog v-model:open="importDialogOpen" @apply="handleImportApply" />

    <!-- Template Spec Dialog -->
    <Dialog v-model:open="specDialogOpen">
      <DialogContent class="w-[min(34rem,calc(100vw-2rem))] space-y-3">
        <div class="space-y-1 pr-6">
          <DialogTitle>Word 试卷模板规范说明</DialogTitle>
          <DialogDescription>
            导出的 .docx 文档严格对齐模板文件的页面尺寸、字号字体与题型解析规则。
          </DialogDescription>
        </div>
        <ul class="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-muted">
          <li>页面设置：A4 竖向，宋体（标题三号加粗居中、大题小四加粗、正文五号）+ Times New Roman，1.5 倍行距。</li>
          <li>连续题号：全卷小题号从 1 起连续递增；子母题只占 1 个母题号，子题以（1）（2）编号。</li>
          <li>子母题标签：仅支持设置整体【难度】【知识点】，子题解析后的【步骤N】紧跟各自子题。</li>
          <li>题组材料：题组必须填写非空“题组题干内容”，以（一）/ 第一节 / A 分隔，小题不支持【难度】【知识点】。</li>
          <li>空白省略：未填写的选项、难度、知识点、答案、解析或步骤在导出时会自动省略。</li>
        </ul>
        <div class="flex justify-end pt-1">
          <DialogClose as-child>
            <Button type="button" variant="primary" size="sm">知道了</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
