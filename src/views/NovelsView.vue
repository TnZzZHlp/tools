<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Search, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { novelApi, errorMessage, type Novel } from '@/api/novels'
import { novelTitle, novelOriginalTitle } from '@/lib/novel-reader'

const query = ref('')
const appliedQuery = ref('')
const page = ref(1)
const total = ref(0)
const novels = ref<Novel[]>([])
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined

async function load(refresh = false) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  try {
    const result = await novelApi.list(page.value, appliedQuery.value, current.signal, refresh)
    if (current.signal.aborted) return
    novels.value = result.items
    total.value = result.total
  } catch (cause) {
    if (!current.signal.aborted) error.value = errorMessage(cause)
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
function search() {
  appliedQuery.value = query.value.trim()
  page.value = 1
  void load()
}
function changePage(delta: number) {
  page.value += delta
  void load()
}
onBeforeUnmount(() => controller?.abort())
void load()
</script>

<template>
  <section class="visible-scrollbar h-full space-y-6 overflow-y-auto pb-6">
    <div class="space-y-2">
      <h1 class="flex items-center gap-2 text-3xl font-semibold tracking-tight">
        <BookOpen class="size-7" />小说阅读
      </h1>
      <p class="text-sm text-muted-foreground">选择小说，阅读译文或原文。</p>
    </div>
    <form class="flex gap-2" role="search" @submit.prevent="search">
      <Input
        v-model="query"
        type="search"
        maxlength="200"
        aria-label="搜索小说标题"
        placeholder="搜索小说标题"
        class="min-w-0 flex-1"
      />
      <Button type="submit" :disabled="loading"><Search class="size-4" />搜索</Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="刷新小说列表"
        :disabled="loading"
        @click="load(true)"
        ><RefreshCw :class="{ 'animate-spin': loading }"
      /></Button>
    </form>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">小说加载中…</p>
    <Alert v-if="error" variant="destructive"
      ><AlertDescription class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span
        ><Button variant="outline" @click="load(true)">重试</Button>
      </AlertDescription></Alert
    >
    <template v-else-if="!loading || novels.length">
      <p class="text-sm text-muted-foreground">共 {{ total }} 部小说</p>
      <p v-if="!novels.length" class="py-12 text-center text-muted-foreground">
        {{ appliedQuery ? '没有找到匹配的小说。' : '暂无小说。' }}
      </p>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="novel in novels" :key="novel.id" class="min-w-0">
          <CardHeader
            ><CardTitle class="break-words leading-relaxed"
              ><RouterLink :to="`/novels/${novel.id}`" class="hover:underline">{{
                novelTitle(novel)
              }}</RouterLink></CardTitle
            >
            <p v-if="novelOriginalTitle(novel)" class="break-words text-sm text-muted-foreground">
              {{ novelOriginalTitle(novel) }}
            </p></CardHeader
          >
          <CardContent class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <Badge variant="secondary">{{ novel.source_language }}</Badge
              ><Badge variant="outline">{{ novel.chapter_count }} 章</Badge>
            </div>
            <p class="text-sm text-muted-foreground">已有译文 {{ novel.translated_count }} 章</p>
          </CardContent>
          <CardFooter
            ><Button as-child
              ><RouterLink :to="`/novels/${novel.id}`">查看目录</RouterLink></Button
            ></CardFooter
          >
        </Card>
      </div>
      <nav v-if="total > 20" aria-label="小说分页" class="flex items-center justify-center gap-3">
        <Button variant="outline" :disabled="page === 1" @click="changePage(-1)">上一页</Button>
        <span class="text-sm">{{ page }} / {{ Math.ceil(total / 20) }}</span>
        <Button variant="outline" :disabled="page * 20 >= total" @click="changePage(1)"
          >下一页</Button
        >
      </nav>
    </template>
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
