<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { novelApi, errorMessage, type ChapterItem } from '@/api/novels'
import {
  chapterPath,
  chapterTitle,
  chapterReadingStatus,
  type ChapterReadingHistory,
  type ReadingMode,
} from '@/lib/novel-reader'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  novelId: string
  title: string
  originalTitle: string
  chapterId: string
  chapterNo: number
  history: ChapterReadingHistory
  mode: ReadingMode
  theme: string
}>()
const chapters = ref<ChapterItem[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const list = ref<HTMLElement>()
let controller: AbortController | undefined
let locateCurrent = false

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
  chapters.value = []
  try {
    let result = await novelApi.chapters(props.novelId, page.value, current.signal, refresh)
    let low = 1
    let high = Math.max(1, Math.ceil(result.total / 100))
    if (page.value > high) {
      page.value = high
      result = await novelApi.chapters(props.novelId, page.value, current.signal, refresh)
    }
    while (
      locateCurrent &&
      result.items.length &&
      !result.items.some((item) => item.id === props.chapterId)
    ) {
      if (props.chapterNo < result.items[0]!.chapter_no) high = page.value - 1
      else if (props.chapterNo > result.items.at(-1)!.chapter_no) low = page.value + 1
      else break
      if (low > high) break
      page.value = Math.floor((low + high) / 2)
      result = await novelApi.chapters(props.novelId, page.value, current.signal, refresh)
    }
    if (current.signal.aborted) return
    locateCurrent = false
    chapters.value = result.items
    total.value = result.total
    loading.value = false
    await nextTick()
    list.value?.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' })
  } catch (cause) {
    if (!current.signal.aborted) error.value = errorMessage(cause)
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

function setPage(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > Math.ceil(total.value / 100)) return
  page.value = value
  locateCurrent = false
  void load()
}

watch(open, (value) => {
  if (value) {
    page.value = Math.max(1, Math.min(1_000_000, Math.ceil(props.chapterNo / 100)))
    locateCurrent = true
    void load()
  } else controller?.abort()
})

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :data-reader-theme="theme"
      class="reader-dialog w-[min(36rem,calc(100vw-2rem))] space-y-4"
    >
      <div>
        <DialogTitle>章节目录</DialogTitle>
        <DialogDescription class="pr-6 break-words">
          <span class="block">{{ title }} · 当前第 {{ chapterNo }} 章</span>
          <span v-if="originalTitle" class="block text-[12px]">{{ originalTitle }}</span>
        </DialogDescription>
      </div>

      <p v-if="loading" role="status" class="text-[14px] text-ink-muted">目录加载中…</p>

      <Alert v-if="error" variant="danger">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <AlertDescription>{{ error }}</AlertDescription>
          <Button variant="secondary" size="sm" @click="load(true)">重试</Button>
        </div>
      </Alert>

      <ol v-else ref="list" class="reader-directory-list space-y-1" aria-label="本书章节">
        <li v-for="item in chapters" :key="item.id">
          <RouterLink
            :to="chapterPath(novelId, item.id)"
            :aria-current="item.id === chapterId ? 'location' : undefined"
            class="flex items-start gap-3 rounded-[10px] px-3 py-3 text-[14px] outline-none transition-colors hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid aria-[current=location]:bg-control aria-[current=location]:font-semibold"
            @click="open = false"
          >
            <span class="w-8 shrink-0 tabular-nums text-ink-muted">{{ item.chapter_no }}</span>
            <span class="min-w-0 flex-1 break-words">{{ chapterTitle(item, mode) }}</span>
            <span class="shrink-0 text-right text-[12px] text-ink-muted">
              <span class="block" data-reading-status>{{
                chapterReadingStatus(history[item.id])
              }}</span>
              <span v-if="!item.has_target" class="block">{{
                item.has_source ? '原文' : '暂无正文'
              }}</span>
            </span>
          </RouterLink>
        </li>
      </ol>

      <p v-if="!loading && !error && !total" role="status" class="text-[14px] text-ink-muted">
        暂无章节。
      </p>

      <nav
        v-if="total > 100"
        aria-label="页内目录分页"
        class="flex items-center justify-between gap-2 border-t border-line pt-4"
      >
        <Button
          variant="secondary"
          size="sm"
          :disabled="loading || page === 1"
          @click="setPage(page - 1)"
        >
          上一页
        </Button>

        <Select
          :model-value="pageModel"
          :disabled="loading"
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
          <SelectContent :data-reader-theme="theme" align="center">
            <SelectItem v-for="index in totalPageCount" :key="index" :value="String(index)">
              {{ index }} / {{ totalPageCount }} 页
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="secondary"
          size="sm"
          :disabled="loading || page * 100 >= total"
          @click="setPage(page + 1)"
        >
          下一页
        </Button>
      </nav>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.reader-directory-list {
  max-height: min(55dvh, 32rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
