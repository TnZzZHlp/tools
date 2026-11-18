<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'

import NovelKnowledge from '@/components/novels/NovelKnowledge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage, novelApi, type ChapterItem, type Novel } from '@/api/novels'
import {
  chapterPath,
  chapterReadingStatus,
  chapterTitle,
  novelOriginalTitle,
  novelTitle,
  progressKey,
  readChapterHistory,
  readProgress,
  writeStored,
  type ChapterReadingHistory,
  type ReadingProgress,
} from '@/lib/novel-reader'

const props = defineProps<{ novelId: string }>()
const novel = ref<Novel | null>(null)
const chapters = ref<ChapterItem[]>([])
const progress = ref<ReadingProgress | null>(null)
const chapterHistory = ref<ChapterReadingHistory>({})
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined

const totalPageCount = computed(() => Math.max(1, Math.ceil(total.value / 100)))
const pageModel = computed({
  get: () => String(page.value),
  set: (val: string) => setPage(Number(val)),
})

async function load(refresh = false) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  const id = props.novelId
  try {
    const [book, directory] = await Promise.all([
      novelApi.detail(id, current.signal, refresh),
      novelApi.chapters(id, page.value, current.signal, refresh),
    ])
    if (current.signal.aborted) return
    novel.value = book
    chapters.value = directory.items
    total.value = directory.total
    document.title = `${novelTitle(book)} · 小说阅读`
  } catch (cause) {
    if (!current.signal.aborted) error.value = errorMessage(cause)
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

function startReading() {
  if (novel.value) writeStored(progressKey(novel.value.id), null)
  progress.value = null
}

function setPage(value: number) {
  if (value < 1 || value > Math.ceil(total.value / 100)) return
  page.value = value
  void load()
}

watch(
  () => props.novelId,
  () => {
    novel.value = null
    chapters.value = []
    page.value = 1
    progress.value = readProgress(props.novelId)
    chapterHistory.value = readChapterHistory(props.novelId)
    void load()
  },
  { immediate: true },
)

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div class="space-y-6 pb-8">
    <div class="flex items-center justify-between gap-3">
      <Button :as="RouterLink" to="/novels" variant="secondary" size="sm">
        <ArrowLeft class="size-4" />
        返回小说列表
      </Button>
      <Button variant="secondary" size="sm" :disabled="loading" @click="load(true)">
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
        刷新目录
      </Button>
    </div>

    <Card v-if="novel">
      <CardContent class="space-y-4 px-5 py-5">
        <div class="space-y-1.5">
          <h1 class="break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {{ novelTitle(novel) }}
          </h1>
          <p v-if="novelOriginalTitle(novel)" class="break-words text-[14px] text-ink-muted">
            {{ novelOriginalTitle(novel) }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <Badge variant="neutral">{{ novel.source_language }}</Badge>
          <Badge variant="outline">
            {{ novel.chapter_count }} 章 · 译文 {{ novel.translated_count }} 章
          </Badge>
        </div>

        <div class="flex flex-wrap gap-2.5 pt-1">
          <Button v-if="progress" :as="RouterLink" :to="chapterPath(novel.id, progress.chapterId)">
            继续阅读 · 第 {{ progress.chapterNo }} 章
          </Button>
          <Button
            v-if="novel.first_chapter_id"
            :as="RouterLink"
            :to="chapterPath(novel.id, novel.first_chapter_id)"
            :variant="progress ? 'secondary' : 'primary'"
            @click="startReading"
          >
            从头阅读
          </Button>
        </div>
      </CardContent>
    </Card>

    <p v-if="loading" role="status" class="text-[14px] text-ink-muted">目录加载中…</p>

    <Alert v-if="error" variant="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>{{ error }}</AlertDescription>
        <Button variant="secondary" size="sm" @click="load(true)">重试</Button>
      </div>
    </Alert>

    <section v-else-if="novel" aria-labelledby="directory-title" class="space-y-4">
      <h2 id="directory-title" class="text-lg font-semibold text-ink sm:text-xl">章节目录</h2>
      <p v-if="!total" class="text-ink-muted">暂无章节。</p>
      <ol class="grid gap-2.5 sm:grid-cols-2">
        <li v-for="chapter in chapters" :key="chapter.id" class="min-w-0">
          <RouterLink
            :to="chapterPath(novel.id, chapter.id)"
            class="flex h-full items-start justify-between gap-3 rounded-panel border border-line bg-raised p-3.5 outline-none transition-colors hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
          >
            <span class="min-w-0 break-words text-[14px] leading-relaxed text-ink">
              <span class="mr-2 font-mono text-[12px] text-ink-muted">
                {{ chapter.chapter_no }}.
              </span>
              {{ chapterTitle(chapter) }}
            </span>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <span class="text-[12px] text-ink-muted" data-reading-status>
                {{ chapterReadingStatus(chapterHistory[chapter.id]) }}
              </span>
              <Badge variant="neutral">
                {{ chapter.has_target ? '译文' : chapter.has_source ? '仅原文' : '暂无正文' }}
              </Badge>
            </span>
          </RouterLink>
        </li>
      </ol>

      <nav
        v-if="total > 100"
        aria-label="目录分页"
        class="flex flex-wrap items-center justify-center gap-3 pt-2"
      >
        <Button variant="secondary" size="sm" :disabled="page === 1" @click="setPage(page - 1)">
          上一页
        </Button>

        <Select
          :model-value="pageModel"
          @update:model-value="
            (v) => {
              if (v) pageModel = v
            }
          "
        >
          <SelectTrigger
            class="h-9 w-auto min-w-28 px-3 text-[13px] tabular-nums"
            aria-label="跳转目录页"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="center">
            <SelectItem v-for="index in totalPageCount" :key="index" :value="String(index)">
              {{ index }} / {{ totalPageCount }} 页
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="secondary"
          size="sm"
          :disabled="page * 100 >= total"
          @click="setPage(page + 1)"
        >
          下一页
        </Button>
      </nav>
    </section>

    <NovelKnowledge v-if="novel" :key="novel.id" :novel-id="novel.id" />
  </div>
</template>
