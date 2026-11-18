<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, RefreshCw } from 'lucide-vue-next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import {
  Pagination,
  PaginationEllipsis,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
} from '@/components/ui/pagination'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { novelApi, errorMessage, type Entity, type Relationship } from '@/api/novels'
import { chapterPath } from '@/lib/novel-reader'

const props = defineProps<{ novelId: string }>()
const revealed = ref(false)
const tab = ref('entities')
const page = ref(1)
const total = ref(0)
const entities = ref<Entity[]>([])
const relationships = ref<Relationship[]>([])
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined

async function load(refresh = false) {
  if (!revealed.value) return
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = ''
  try {
    if (tab.value === 'entities') {
      const result = await novelApi.entities(props.novelId, page.value, current.signal, refresh)
      if (current.signal.aborted) return
      entities.value = result.items
      total.value = result.total
    } else {
      const result = await novelApi.relationships(
        props.novelId,
        page.value,
        current.signal,
        refresh,
      )
      if (current.signal.aborted) return
      relationships.value = result.items
      total.value = result.total
    }
  } catch (cause) {
    if (!current.signal.aborted) error.value = errorMessage(cause)
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}
watch(
  tab,
  () => {
    page.value = 1
  },
  { flush: 'sync' },
)
watch([revealed, tab, page], () => void load())
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section aria-labelledby="knowledge-title" class="space-y-4 border-t border-line pt-6">
    <div class="flex items-center justify-between gap-3">
      <h2 id="knowledge-title" class="text-xl font-semibold text-ink">人物与关系</h2>
      <Button
        v-if="revealed"
        variant="secondary"
        size="sm"
        class="w-8 px-0"
        aria-label="刷新人物与关系"
        :disabled="loading"
        @click="load(true)"
      >
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
      </Button>
    </div>

    <template v-if="!revealed">
      <p class="text-[14px] text-ink-muted">包含人物、地点等实体和关系资料，可能透露后续剧情。</p>
      <Button variant="secondary" size="sm" @click="revealed = true">显示人物与关系</Button>
    </template>

    <template v-else>
      <Tabs v-model="tab">
        <TabsList aria-label="资料分类">
          <TabsTrigger value="entities">人物与实体</TabsTrigger>
          <TabsTrigger value="relationships">关系</TabsTrigger>
        </TabsList>

        <p v-if="loading" role="status" class="mt-3 text-[14px] text-ink-muted">资料加载中…</p>

        <Alert v-if="error" variant="danger" class="mt-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <AlertDescription>{{ error }}</AlertDescription>
            <Button variant="secondary" size="sm" @click="load(true)">重试</Button>
          </div>
        </Alert>

        <template v-else-if="!loading">
          <p class="mt-3 text-[13px] text-ink-muted">共 {{ total }} 条资料</p>
          <p v-if="!total" class="mt-2 text-[14px] text-ink-muted">暂无资料。</p>

          <TabsContent value="entities" class="grid gap-4 sm:grid-cols-2">
            <Card v-for="entity in entities" :key="entity.id" class="min-w-0">
              <CardHeader>
                <template #title>
                  <span class="break-words">{{ entity.target_name || entity.source_name }}</span>
                </template>
              </CardHeader>
              <CardContent class="space-y-3 break-words pt-0 text-[14px]">
                <Badge variant="neutral">{{ entity.kind }}</Badge>
                <p v-if="entity.target_name" class="text-ink-muted">
                  {{ entity.source_name }}
                </p>
                <p v-if="entity.description" class="whitespace-pre-wrap text-ink">
                  {{ entity.description }}
                </p>
                <RouterLink
                  v-if="entity.first_seen_chapter_id"
                  :to="chapterPath(novelId, entity.first_seen_chapter_id)"
                  class="inline-block text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  首次出现：第 {{ entity.first_seen_chapter_no }} 章
                </RouterLink>
                <details v-if="Object.keys(entity.attributes).length">
                  <summary class="cursor-pointer text-ink-muted">补充资料</summary>
                  <pre class="mt-2 whitespace-pre-wrap break-words font-sans text-[12px]">{{
                    JSON.stringify(entity.attributes, null, 2)
                  }}</pre>
                </details>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relationships" class="grid gap-4 sm:grid-cols-2">
            <Card v-for="relation in relationships" :key="relation.id" class="min-w-0">
              <CardHeader>
                <template #title>
                  <span class="flex flex-wrap items-center gap-2 break-words">
                    <span>{{ relation.subject_target_name || relation.subject_source_name }}</span>
                    <ArrowRight class="size-4 shrink-0" aria-hidden="true" />
                    <span>{{ relation.object_target_name || relation.object_source_name }}</span>
                  </span>
                </template>
              </CardHeader>
              <CardContent class="space-y-3 break-words pt-0 text-[14px]">
                <Badge variant="neutral" class="max-w-full whitespace-normal">
                  {{ relation.predicate }}
                </Badge>
                <p v-if="relation.description" class="whitespace-pre-wrap text-ink">
                  {{ relation.description }}
                </p>
                <div class="flex flex-wrap gap-3">
                  <RouterLink
                    v-if="relation.start_chapter_id"
                    :to="chapterPath(novelId, relation.start_chapter_id)"
                    class="text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                  >
                    起始：第 {{ relation.start_chapter_no }} 章
                  </RouterLink>
                  <RouterLink
                    v-if="relation.end_chapter_id"
                    :to="chapterPath(novelId, relation.end_chapter_id)"
                    class="text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                  >
                    结束：第 {{ relation.end_chapter_no }} 章
                  </RouterLink>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <Pagination
            v-if="total > 30"
            v-model:page="page"
            :total="total"
            :items-per-page="30"
            aria-label="资料分页"
            class="mt-4"
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
      </Tabs>
    </template>
  </section>
</template>
