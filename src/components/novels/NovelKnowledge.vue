<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  <section aria-labelledby="knowledge-title" class="space-y-4 border-t pt-6">
    <div class="flex items-center justify-between gap-3">
      <h2 id="knowledge-title" class="text-xl font-semibold">人物与关系</h2>
      <Button
        v-if="revealed"
        variant="outline"
        size="icon"
        aria-label="刷新人物与关系"
        :disabled="loading"
        @click="load(true)"
        ><RefreshCw :class="{ 'animate-spin': loading }"
      /></Button>
    </div>
    <template v-if="!revealed">
      <p class="text-sm text-muted-foreground">
        包含人物、地点等实体和关系资料，可能透露后续剧情。
      </p>
      <Button variant="outline" @click="revealed = true">显示人物与关系</Button>
    </template>
    <template v-else>
      <Tabs v-model="tab"
        ><TabsList aria-label="资料分类"
          ><TabsTrigger value="entities">人物与实体</TabsTrigger
          ><TabsTrigger value="relationships">关系</TabsTrigger></TabsList
        >
        <p v-if="loading" role="status" class="text-sm text-muted-foreground">资料加载中…</p>
        <Alert v-if="error" variant="destructive"
          ><AlertDescription class="flex flex-wrap items-center justify-between gap-3"
            ><span>{{ error }}</span
            ><Button variant="outline" @click="load(true)">重试</Button></AlertDescription
          ></Alert
        >
        <template v-else-if="!loading">
          <p class="text-sm text-muted-foreground">共 {{ total }} 条资料</p>
          <p v-if="!total" class="text-muted-foreground">暂无资料。</p>
          <TabsContent value="entities" class="grid gap-4 sm:grid-cols-2">
            <Card v-for="entity in entities" :key="entity.id" class="min-w-0">
              <CardHeader
                ><CardTitle class="break-words">{{
                  entity.target_name || entity.source_name
                }}</CardTitle></CardHeader
              >
              <CardContent class="space-y-3 break-words text-sm">
                <Badge variant="secondary">{{ entity.kind }}</Badge>
                <p v-if="entity.target_name" class="text-muted-foreground">
                  {{ entity.source_name }}
                </p>
                <p v-if="entity.description" class="whitespace-pre-wrap">
                  {{ entity.description }}
                </p>
                <RouterLink
                  v-if="entity.first_seen_chapter_id"
                  :to="chapterPath(novelId, entity.first_seen_chapter_id)"
                  class="underline underline-offset-4"
                  >首次出现：第 {{ entity.first_seen_chapter_no }} 章</RouterLink
                >
                <details v-if="Object.keys(entity.attributes).length">
                  <summary class="cursor-pointer text-muted-foreground">补充资料</summary>
                  <pre class="mt-2 whitespace-pre-wrap break-words font-sans text-xs">{{
                    JSON.stringify(entity.attributes, null, 2)
                  }}</pre>
                </details>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="relationships" class="grid gap-4 sm:grid-cols-2">
            <Card v-for="relation in relationships" :key="relation.id" class="min-w-0">
              <CardHeader
                ><CardTitle class="flex flex-wrap items-center gap-2 break-words text-base"
                  ><span>{{ relation.subject_target_name || relation.subject_source_name }}</span
                  ><ArrowRight class="size-4 shrink-0" aria-hidden="true" /><span>{{
                    relation.object_target_name || relation.object_source_name
                  }}</span></CardTitle
                ></CardHeader
              >
              <CardContent class="space-y-3 break-words text-sm">
                <Badge variant="secondary" class="max-w-full whitespace-normal">{{
                  relation.predicate
                }}</Badge>
                <p v-if="relation.description" class="whitespace-pre-wrap">
                  {{ relation.description }}
                </p>
                <div class="flex flex-wrap gap-3">
                  <RouterLink
                    v-if="relation.start_chapter_id"
                    :to="chapterPath(novelId, relation.start_chapter_id)"
                    class="underline underline-offset-4"
                    >起始：第 {{ relation.start_chapter_no }} 章</RouterLink
                  >
                  <RouterLink
                    v-if="relation.end_chapter_id"
                    :to="chapterPath(novelId, relation.end_chapter_id)"
                    class="underline underline-offset-4"
                    >结束：第 {{ relation.end_chapter_no }} 章</RouterLink
                  >
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <nav
            v-if="total > 30"
            aria-label="资料分页"
            class="flex items-center justify-center gap-3"
          >
            <Button variant="outline" :disabled="page === 1" @click="page--">上一页</Button
            ><span class="text-sm">{{ page }} / {{ Math.ceil(total / 30) }}</span
            ><Button variant="outline" :disabled="page * 30 >= total" @click="page++"
              >下一页</Button
            >
          </nav>
        </template>
      </Tabs>
    </template>
  </section>
</template>
