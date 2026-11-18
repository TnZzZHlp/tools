<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, RefreshCw, Search } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationEllipsis,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
} from '@/components/ui/pagination'
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
          variant="secondary"
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
        class="min-w-0 flex-1 bg-raised"
      />
      <Button type="submit" :loading="loading">
        <Search class="size-4" />
        搜索
      </Button>
    </form>

    <p v-if="loading" role="status" class="text-[14px] text-ink-muted">小说加载中…</p>

    <Alert v-if="error" variant="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>{{ error }}</AlertDescription>
        <Button variant="secondary" size="sm" @click="load(true)">重试</Button>
      </div>
    </Alert>

    <template v-else-if="!loading || novels.length">
      <p class="text-[13px] text-ink-muted">共 {{ total }} 部小说</p>
      <p v-if="!novels.length" class="py-12 text-center text-[14px] text-ink-muted">
        {{ appliedQuery ? '没有找到匹配的小说。' : '暂无小说。' }}
      </p>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="novel in novels" :key="novel.id" class="min-w-0 justify-between">
          <div>
            <CardHeader>
              <template #title>
                <RouterLink :to="`/novels/${novel.id}`" class="break-words hover:underline">
                  {{ novelTitle(novel) }}
                </RouterLink>
              </template>
              <template v-if="novelOriginalTitle(novel)" #description>
                <p class="break-words text-[13px] text-ink-muted">
                  {{ novelOriginalTitle(novel) }}
                </p>
              </template>
            </CardHeader>
            <CardContent class="space-y-3 pt-0">
              <div class="flex flex-wrap gap-2">
                <Badge variant="neutral">{{ novel.source_language }}</Badge>
                <Badge variant="outline">{{ novel.chapter_count }} 章</Badge>
              </div>
              <p class="text-[13px] text-ink-muted">已有译文 {{ novel.translated_count }} 章</p>
            </CardContent>
          </div>

          <CardFooter>
            <Button
              :as="RouterLink"
              :to="`/novels/${novel.id}`"
              variant="secondary"
              size="sm"
              class="w-full"
            >
              查看目录
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Pagination
        v-if="total > 20"
        :page="page"
        :total="total"
        :items-per-page="20"
        aria-label="小说分页"
        @update:page="
          (nextPage) => {
            if (nextPage === undefined) return
            page = nextPage
            void load()
          }
        "
      >
        <PaginationList v-slot="{ items }">
          <PaginationPrev />
          <template v-for="(item, index) in items" :key="index">
            <PaginationListItem v-if="item.type === 'page'" :value="item.value" />
            <PaginationEllipsis v-else :index="index" />
          </template>
          <PaginationNext />
        </PaginationList>
      </Pagination>
    </template>
  </div>
</template>
