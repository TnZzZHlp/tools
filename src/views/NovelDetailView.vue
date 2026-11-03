<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import NovelKnowledge from '@/components/novels/NovelKnowledge.vue'
import { novelApi, errorMessage, type Novel, type ChapterItem } from '@/api/novels'
import {
  readProgress,
  readChapterHistory,
  chapterReadingStatus,
  type ChapterReadingHistory,
  chapterPath,
  chapterTitle,
  novelTitle,
  novelOriginalTitle,
  writeStored,
  progressKey,
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
  <section class="visible-scrollbar h-full space-y-6 overflow-y-auto pb-6">
    <div class="flex items-center justify-between gap-3">
      <Button as-child variant="outline"><RouterLink to="/novels">返回小说列表</RouterLink></Button>
      <Button variant="outline" :disabled="loading" @click="load(true)"
        ><RefreshCw :class="{ 'animate-spin': loading }" />刷新目录</Button
      >
    </div>
    <template v-if="novel">
      <div class="space-y-4">
        <h1 class="break-words text-3xl font-semibold tracking-tight">{{ novelTitle(novel) }}</h1>
        <p v-if="novelOriginalTitle(novel)" class="break-words text-sm text-muted-foreground">
          {{ novelOriginalTitle(novel) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Badge variant="secondary">{{ novel.source_language }}</Badge
          ><Badge variant="outline"
            >{{ novel.chapter_count }} 章 · 译文 {{ novel.translated_count }} 章</Badge
          >
        </div>
        <div class="flex flex-wrap gap-3">
          <Button v-if="progress" as-child
            ><RouterLink :to="chapterPath(novel.id, progress.chapterId)"
              >继续阅读 · 第 {{ progress.chapterNo }} 章</RouterLink
            ></Button
          >
          <Button v-if="novel.first_chapter_id" as-child :variant="progress ? 'outline' : 'default'"
            ><RouterLink :to="chapterPath(novel.id, novel.first_chapter_id)" @click="startReading"
              >从头阅读</RouterLink
            ></Button
          >
        </div>
      </div>
    </template>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">目录加载中…</p>
    <Alert v-if="error" variant="destructive"
      ><AlertDescription class="flex flex-wrap items-center justify-between gap-3"
        ><span>{{ error }}</span
        ><Button variant="outline" @click="load(true)">重试</Button></AlertDescription
      ></Alert
    >
    <section v-else-if="novel" aria-labelledby="directory-title" class="space-y-4">
      <h2 id="directory-title" class="text-xl font-semibold">章节目录</h2>
      <p v-if="!total" class="text-muted-foreground">暂无章节。</p>
      <ol class="grid gap-2 sm:grid-cols-2">
        <li v-for="chapter in chapters" :key="chapter.id" class="min-w-0">
          <RouterLink
            :to="chapterPath(novel.id, chapter.id)"
            class="flex h-full items-start justify-between gap-3 rounded-md border p-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span class="min-w-0 break-words text-sm"
              ><span class="mr-2 text-muted-foreground">{{ chapter.chapter_no }}.</span
              >{{ chapterTitle(chapter) }}</span
            >
            <span class="flex shrink-0 flex-col items-end gap-1">
              <span class="text-xs text-muted-foreground" data-reading-status>{{
                chapterReadingStatus(chapterHistory[chapter.id])
              }}</span>
              <Badge variant="secondary">{{
                chapter.has_target ? '译文' : chapter.has_source ? '仅原文' : '暂无正文'
              }}</Badge>
            </span>
          </RouterLink>
        </li>
      </ol>
      <nav
        v-if="total > 100"
        aria-label="目录分页"
        class="flex flex-wrap items-center justify-center gap-3"
      >
        <Button variant="outline" :disabled="page === 1" @click="setPage(page - 1)">上一页</Button>
        <Select :model-value="String(page)" @update:model-value="setPage(Number($event))"
          ><SelectTrigger class="w-30" aria-label="跳转目录页"><SelectValue /></SelectTrigger
          ><SelectContent
            ><SelectItem v-for="index in Math.ceil(total / 100)" :key="index" :value="String(index)"
              >{{ index }} / {{ Math.ceil(total / 100) }} 页</SelectItem
            ></SelectContent
          ></Select
        >
        <Button variant="outline" :disabled="page * 100 >= total" @click="setPage(page + 1)"
          >下一页</Button
        >
      </nav>
    </section>
    <NovelKnowledge v-if="novel" :key="novel.id" :novel-id="novel.id" />
  </section>
</template>

<style scoped>
.visible-scrollbar {
  scrollbar-width: thin;
}

.visible-scrollbar::-webkit-scrollbar {
  display: block;
  width: 8px;
  height: 8px;
}

.visible-scrollbar::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 22%, transparent);
  border-radius: 9999px;
}

.visible-scrollbar::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
