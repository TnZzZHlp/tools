<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, RefreshCw, Search } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage, novelApi, type Novel } from '@/api/novels'
import { novelOriginalTitle, novelTitle } from '@/lib/novel-reader'

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
  <div class="space-y-6 pb-8">
    <ToolPageHeader
      title="小说阅读"
      description="浏览书库作品，随时切换阅读中文译文、双语对照或原文。"
      :icon="BookOpen"
    >
      <template #actions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="刷新小说列表"
          :disabled="loading"
          @click="load(true)"
        >
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
      </template>
    </ToolPageHeader>

    <form class="flex gap-2" role="search" @submit.prevent="search">
      <Input
        v-model="query"
        type="search"
        maxlength="200"
        aria-label="搜索小说标题"
        placeholder="搜索小说标题…"
        class="min-w-0 flex-1 bg-card"
      />
      <Button type="submit" :disabled="loading">
        <Search class="size-4" />
        搜索
      </Button>
    </form>

    <p v-if="loading" role="status" class="text-sm text-muted-foreground">小说加载中…</p>

    <Alert v-if="error" variant="destructive">
      <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <Button variant="outline" size="sm" @click="load(true)">重试</Button>
      </AlertDescription>
    </Alert>

    <template v-else-if="!loading || novels.length">
      <p class="text-sm text-muted-foreground">共 {{ total }} 部小说</p>
      <p v-if="!novels.length" class="py-12 text-center text-muted-foreground">
        {{ appliedQuery ? '没有找到匹配的小说。' : '暂无小说。' }}
      </p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="novel in novels" :key="novel.id" class="flex min-w-0 flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle class="break-words leading-relaxed">
                <RouterLink :to="`/novels/${novel.id}`" class="hover:underline">
                  {{ novelTitle(novel) }}
                </RouterLink>
              </CardTitle>
              <p v-if="novelOriginalTitle(novel)" class="break-words text-sm text-muted-foreground">
                {{ novelOriginalTitle(novel) }}
              </p>
            </CardHeader>
            <CardContent class="space-y-3 pt-2">
              <div class="flex flex-wrap gap-2">
                <Badge variant="secondary">{{ novel.source_language }}</Badge>
                <Badge variant="outline">{{ novel.chapter_count }} 章</Badge>
              </div>
              <p class="text-sm text-muted-foreground">已有译文 {{ novel.translated_count }} 章</p>
            </CardContent>
          </div>

          <CardFooter class="pt-2">
            <Button as-child variant="outline" class="w-full">
              <RouterLink :to="`/novels/${novel.id}`">查看目录</RouterLink>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <nav v-if="total > 20" aria-label="小说分页" class="flex items-center justify-center gap-3">
        <Button variant="outline" :disabled="page === 1" @click="changePage(-1)">上一页</Button>
        <span class="text-sm tabular-nums">{{ page }} / {{ Math.ceil(total / 20) }}</span>
        <Button variant="outline" :disabled="page * 20 >= total" @click="changePage(1)">
          下一页
        </Button>
      </nav>
    </template>
  </div>
</template>
