<script setup lang="ts">
import { ArrowDown, ArrowUp, FolderPlus, Layers, Plus, Trash2 } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExamPaperContext } from "@/composables/useExamPaperEditor";
import { SECTION_PRESETS, type SectionPreset } from "@/lib/exam-paper/presets";
import { formatGroupDelimiter, formatScore, toChineseNumeral } from "@/lib/exam-paper/render";
import type { ExamSection, SectionItem } from "@/lib/exam-paper/types";

const emit = defineEmits<{
  itemSelected: [];
}>();

const editor = useExamPaperContext();

function sectionScoreBadge(section: ExamSection): string {
  if (section.scoreMode === "uniform") {
    if (typeof section.scorePerQuestion === "number" && section.scorePerQuestion > 0) {
      return `${formatScore(section.scorePerQuestion)}分/题`;
    }
    return "待标分";
  }
  if (section.scoreMode === "per-question") {
    return "逐题";
  }
  return "";
}

function itemLabel(item: SectionItem): string {
  if (item.kind === "group") {
    const passage = item.passage.trim().replace(/\s+/g, " ");
    return passage || "题组材料待填写";
  }
  const clean = item.stem.trim().replace(/\s+/g, " ");
  return clean || "未填题干";
}

function itemHasAnswer(item: SectionItem): boolean {
  if (item.kind === "standard") return item.answer.trim().length > 0;
  if (item.kind === "compound")
    return item.subQuestions.some((sub) => sub.answer.trim().length > 0);
  return false;
}

function itemHasAnalysis(item: SectionItem): boolean {
  if (item.kind === "standard") return item.analysis.trim().length > 0;
  if (item.kind === "compound") {
    return item.subQuestions.some((sub) => sub.analysis.trim().length > 0);
  }
  return false;
}

function handleSelectSection(sectionId: string) {
  editor.selectSection(sectionId);
  emit("itemSelected");
}

function handleSelectItem(sectionId: string, itemId: string, childId?: string) {
  editor.selectItem(sectionId, itemId, childId);
  emit("itemSelected");
}

function handleAddQuickItem(section: ExamSection) {
  const hasGroup = section.items.some((it) => it.kind === "group");
  editor.addItem(section.id, hasGroup ? "group" : "standard");
  emit("itemSelected");
}

function handleAddSection(preset: SectionPreset) {
  editor.addSectionFromPreset(preset);
  emit("itemSelected");
}
</script>

<template>
  <aside
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-raised"
    aria-label="试卷大纲目录"
  >
    <div class="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
      <span class="text-[13px] font-semibold text-ink">试卷大纲</span>
      <Badge variant="outline" class="font-mono text-[11px] tabular-nums">
        {{ editor.stats.value.questionCount }} 题
      </Badge>
    </div>

    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
      <div
        v-for="(section, secIdx) in editor.doc.value.sections"
        :key="section.id"
        class="space-y-1"
      >
        <!-- Section Row -->
        <div
          class="group flex items-center gap-1 rounded-control px-2 py-1.5 transition-colors"
          :class="
            editor.activeSection.value?.id === section.id
              ? 'bg-control/75 text-ink'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
          "
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-semibold"
            @click="handleSelectSection(section.id)"
          >
            <span class="shrink-0 font-mono text-ink">{{ toChineseNumeral(secIdx + 1) }}、</span>
            <span class="truncate text-ink">{{ section.title.trim() || "未命名大题" }}</span>
            <span
              v-if="sectionScoreBadge(section)"
              class="shrink-0 rounded-[5px] border border-line bg-surface px-1 py-0 text-[10px] font-normal text-ink-muted"
            >
              {{ sectionScoreBadge(section) }}
            </span>
          </button>

          <div
            class="flex shrink-0 items-center gap-0.5 opacity-85 transition-opacity group-hover:opacity-100"
          >
            <button
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-[5px] text-ink-muted hover:bg-raised hover:text-ink"
              title="在本大题新增题目"
              aria-label="在本大题新增题目"
              @click="handleAddQuickItem(section)"
            >
              <Plus class="size-3" />
            </button>
            <button
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-[5px] text-ink-muted hover:bg-raised hover:text-ink disabled:opacity-35"
              :disabled="secIdx === 0"
              aria-label="上移大题"
              @click="editor.moveSection(secIdx, -1)"
            >
              <ArrowUp class="size-3" />
            </button>
            <button
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-[5px] text-ink-muted hover:bg-raised hover:text-ink disabled:opacity-35"
              :disabled="secIdx === editor.doc.value.sections.length - 1"
              aria-label="下移大题"
              @click="editor.moveSection(secIdx, 1)"
            >
              <ArrowDown class="size-3" />
            </button>
            <button
              type="button"
              class="inline-flex size-5 items-center justify-center rounded-[5px] text-ink-muted hover:bg-raised hover:text-danger"
              aria-label="删除大题"
              @click="editor.removeSection(secIdx)"
            >
              <Trash2 class="size-3" />
            </button>
          </div>
        </div>

        <!-- Section Items -->
        <div v-if="section.items.length > 0" class="space-y-1 pl-1.5">
          <template v-for="item in section.items" :key="item.id">
            <!-- Group Header + Indented Children -->
            <div v-if="item.kind === 'group'" class="space-y-1">
              <button
                type="button"
                class="flex w-full items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-left text-[12px] transition-colors"
                :class="
                  editor.activeItem.value?.id === item.id && !editor.activeGroupChild.value
                    ? 'border-ink/30 bg-control font-medium text-ink'
                    : editor.activeItem.value?.id === item.id
                      ? 'border-line bg-surface font-medium text-ink'
                      : 'border-transparent text-ink-muted hover:bg-surface hover:text-ink'
                "
                @click="handleSelectItem(section.id, item.id)"
              >
                <FolderPlus class="size-3.5 shrink-0 text-accent-alt" aria-hidden="true" />
                <span class="shrink-0 font-medium text-ink">
                  {{
                    formatGroupDelimiter(
                      item.delimiterStyle,
                      editor.numbering.value.groupIndexes.get(item.id) ?? 1,
                    )
                  }}
                </span>
                <span class="min-w-0 flex-1 truncate">
                  {{ item.passage.trim() ? item.passage.trim() : "题组材料待填写" }}
                </span>
                <span
                  v-if="(editor.issueCountByItem.value.get(item.id)?.errors ?? 0) > 0"
                  class="size-1.5 shrink-0 rounded-full bg-danger"
                  title="存在必填错误"
                />
              </button>

              <div class="space-y-0.5 border-l border-line pl-2.5 ml-2.5">
                <button
                  v-for="child in item.questions"
                  :key="child.id"
                  type="button"
                  class="flex w-full items-center gap-1.5 rounded-[8px] border px-2 py-1 text-left text-[12px] transition-colors"
                  :class="
                    editor.activeItem.value?.id === item.id &&
                    editor.activeGroupChild.value?.id === child.id
                      ? 'border-ink/30 bg-control font-medium text-ink'
                      : 'border-transparent text-ink-muted hover:bg-surface hover:text-ink'
                  "
                  @click="handleSelectItem(section.id, item.id, child.id)"
                >
                  <span
                    class="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-[5px] bg-surface px-1 font-mono text-[10px] text-ink tabular-nums"
                  >
                    {{ editor.numbering.value.questionNumbers.get(child.id) ?? "?" }}
                  </span>
                  <span
                    class="min-w-0 flex-1 truncate"
                    :class="!child.stem.trim() && 'text-ink-faint italic'"
                  >
                    {{ child.stem.trim() || "未填题干" }}
                  </span>
                  <span
                    v-if="child.answer.trim()"
                    class="shrink-0 text-[10px] text-accent"
                    title="已填答案"
                  >
                    答
                  </span>
                  <span
                    v-if="(editor.issueCountByItem.value.get(child.id)?.errors ?? 0) > 0"
                    class="size-1.5 shrink-0 rounded-full bg-danger"
                    title="存在必填错误"
                  />
                </button>
              </div>
            </div>

            <!-- Standard or Compound Question Row -->
            <button
              v-else
              type="button"
              class="flex w-full items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-left text-[12px] transition-colors"
              :class="
                editor.activeItem.value?.id === item.id
                  ? 'border-ink/30 bg-control font-medium text-ink'
                  : 'border-transparent text-ink-muted hover:bg-surface hover:text-ink'
              "
              @click="handleSelectItem(section.id, item.id)"
            >
              <span
                class="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-[5px] bg-surface px-1 font-mono text-[10px] text-ink tabular-nums"
              >
                {{ editor.numbering.value.questionNumbers.get(item.id) ?? "?" }}
              </span>
              <span
                class="min-w-0 flex-1 truncate"
                :class="!item.stem.trim() && 'text-ink-faint italic'"
              >
                {{ itemLabel(item) }}
              </span>

              <span
                v-if="item.kind === 'compound'"
                class="inline-flex shrink-0 items-center gap-0.5 rounded-[5px] border border-line bg-surface px-1 text-[10px] text-ink-muted"
                title="子母题"
              >
                <Layers class="size-2.5" />
                {{ item.subQuestions.length }}
              </span>
              <span
                v-if="itemHasAnswer(item)"
                class="shrink-0 text-[10px] text-accent"
                title="已填答案"
              >
                答
              </span>
              <span
                v-if="itemHasAnalysis(item)"
                class="shrink-0 text-[10px] text-accent-alt"
                title="已填解析"
              >
                解
              </span>
              <span
                v-if="(editor.issueCountByItem.value.get(item.id)?.errors ?? 0) > 0"
                class="size-1.5 shrink-0 rounded-full bg-danger"
                title="存在必填错误"
              />
            </button>
          </template>
        </div>

        <p v-else class="px-3 py-1 text-[11px] text-ink-faint">暂无题目</p>
      </div>

      <div
        v-if="editor.doc.value.sections.length === 0"
        class="rounded-control border border-dashed border-line bg-surface px-3 py-6 text-center text-[12px] text-ink-muted"
      >
        还没有任何大题，请点击下方按钮添加。
      </div>
    </div>

    <div class="shrink-0 border-t border-line p-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button type="button" variant="secondary" size="sm" class="w-full justify-center">
            <Plus class="size-3.5" />
            添加题组
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuItem
            v-for="preset in SECTION_PRESETS"
            :key="preset.id"
            @select="handleAddSection(preset)"
          >
            <Plus class="size-3.5 text-ink-muted" />
            <span>{{ preset.label }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </aside>
</template>
