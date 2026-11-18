<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Braces, Check, ClipboardCopy, Eraser, Sparkles } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { parseTracingMacro } from '@/utils/parseTracingMacro'

const exampleInput = `debug!(
    manga_name = manga.name,
    parsed_count = parsed_chapters.len(),
    skipped_count = skipped_count,
    "Search complete for manga, no new chapters"
);
info!(image_index = image.index, path = ?image_path, "Downloaded image");
info!(image_index = image.index, path = ?image_path, "Skipped existing image");
warn!(image_index = image.index, error = %e, "Failed to download image");`

const source = ref(exampleInput)
const copySuccess = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const parseResult = computed(() => parseTracingMacro(source.value))
const output = computed(() => parseResult.value.data?.template ?? '')
const parsedMacros = computed(() => parseResult.value.data?.macros ?? [])

async function copyOutput() {
  if (!output.value) return

  try {
    await navigator.clipboard?.writeText(output.value)
    copySuccess.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccess.value = false
    }, 1800)
  } catch {
    const textarea = document.querySelector('#logql-output') as HTMLTextAreaElement | null
    textarea?.select()
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div class="flex flex-col pb-8">
    <ToolPageHeader
      title="Rust tracing → LogQL"
      description="批量解析 trace! / debug! / info! / warn! / error! 宏并提取字段，自动生成 Grafana Loki LogQL 模板。"
      :icon="Braces"
    >
      <template #actions>
        <Button type="button" variant="outline" size="sm" @click="source = exampleInput">
          <Sparkles class="size-4" />
          恢复示例
        </Button>
        <Button type="button" variant="outline" size="sm" :disabled="!source" @click="source = ''">
          <Eraser class="size-4" />
          清空
        </Button>
      </template>
    </ToolPageHeader>

    <div
      class="grid gap-4 lg:grid-cols-2 xl:h-[calc(100dvh-11.5rem)] xl:min-h-[28rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_21rem]"
    >
      <!-- Rust Input Card -->
      <Card class="flex min-h-72 min-w-0 flex-col gap-3 py-4 xl:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-sm font-semibold sm:text-base">
              <label for="tracing-source">Rust 宏代码</label>
            </CardTitle>
            <Badge variant="secondary" class="font-normal">支持多条批量粘贴</Badge>
          </div>
        </CardHeader>
        <CardContent class="flex min-h-0 flex-1 flex-col px-4">
          <Textarea
            id="tracing-source"
            v-model="source"
            data-testid="tracing-input"
            class="h-full min-h-56 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 xl:min-h-0"
            :placeholder="exampleInput"
            spellcheck="false"
          />
        </CardContent>
      </Card>

      <!-- LogQL Output Card -->
      <Card class="flex min-h-72 min-w-0 flex-col gap-3 py-4 xl:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <CardTitle class="text-sm font-semibold sm:text-base">
                <label for="logql-output">LogQL 模板字符串</label>
              </CardTitle>
              <Badge v-if="parsedMacros.length" variant="outline" class="font-normal tabular-nums">
                {{ parsedMacros.length }} 行
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="h-8 text-xs"
              :disabled="!output"
              :aria-label="copySuccess ? '已复制' : '复制到剪贴板'"
              :class="
                copySuccess &&
                'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              "
              @click="copyOutput"
            >
              <Check v-if="copySuccess" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copySuccess ? '已复制' : '复制模板' }}
            </Button>
          </div>
        </CardHeader>

        <CardContent class="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <Textarea
            id="logql-output"
            :model-value="output"
            data-testid="logql-output"
            class="h-full min-h-56 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 xl:min-h-0"
            placeholder="解析生成的 LogQL line_format 模板将显示在这里…"
            readonly
          />

          <Alert
            v-if="parseResult.error"
            variant="destructive"
            class="shrink-0"
            role="alert"
            aria-live="polite"
          >
            <AlertTitle>解析失败</AlertTitle>
            <AlertDescription>{{ parseResult.error }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <!-- Parsed Structure Details Card -->
      <Card class="flex min-w-0 flex-col gap-3 py-4 lg:col-span-2 xl:col-span-1 xl:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-sm font-semibold sm:text-base">解析字段明细</CardTitle>
            <Badge variant="secondary" class="font-normal tabular-nums">
              {{ parsedMacros.length }} 条宏
            </Badge>
          </div>
        </CardHeader>

        <CardContent class="min-h-0 flex-1 overflow-y-auto px-4">
          <div v-if="parsedMacros.length" class="space-y-3">
            <article
              v-for="(macro, index) in parsedMacros"
              :key="`${macro.macroName}-${index}`"
              class="space-y-2.5 rounded-lg border bg-muted/20 p-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <Badge class="font-mono">{{ macro.macroName }}!</Badge>
                <span class="text-xs text-muted-foreground">#{{ index + 1 }}</span>
              </div>

              <div v-if="macro.message" class="space-y-1">
                <p class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Message
                </p>
                <p class="text-sm leading-relaxed text-foreground">{{ macro.message }}</p>
              </div>

              <div v-if="macro.fields.length" class="space-y-1.5">
                <p class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Fields ({{ macro.fields.length }})
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="field in macro.fields"
                    :key="field.key"
                    variant="outline"
                    class="bg-background font-mono text-xs"
                  >
                    {{ field.key }}
                  </Badge>
                </div>
              </div>
            </article>
          </div>

          <Alert v-else class="border-dashed bg-transparent">
            <AlertTitle>等待输入</AlertTitle>
            <AlertDescription
              >粘贴一段合法的 Rust tracing 宏后，提取出的消息与字段将展示在此处。</AlertDescription
            >
          </Alert>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
