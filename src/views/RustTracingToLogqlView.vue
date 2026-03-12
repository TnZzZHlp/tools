<script setup lang="ts">
import { computed, ref } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { parseTracingMacro } from '@/utils/parseTracingMacro'
import { ClipboardCopy } from 'lucide-vue-next'

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
const copyStatus = ref('')

const parseResult = computed(() => parseTracingMacro(source.value))
const output = computed(() => parseResult.value.data?.template ?? '')
const parsedMacros = computed(() => parseResult.value.data?.macros ?? [])

async function copyOutput() {
  if (!output.value) {
    copyStatus.value = '当前没有可复制的结果。'
    return
  }

  try {
    await navigator.clipboard?.writeText(output.value)
    copyStatus.value = '已复制到剪贴板。'
  } catch {
    copyStatus.value = '复制失败，请手动选中文本。'
  }
}

</script>

<template>
  <section class="grid h-full w-full min-h-0 gap-6 overflow-hidden lg:grid-cols-3 lg:gap-0">
    <section class="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full lg:pr-6">
      <header class="shrink-0">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <Badge variant="secondary">输入 Rust tracing 宏</Badge>
            <div>
              <h2 class="text-xl font-semibold tracking-tight">生成 LogQL 模板</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                支持
                <code>trace!</code>、<code>debug!</code>、<code>info!</code>、<code>warn!</code>、<code>error!</code>，支持批量粘贴多条宏。
              </p>
            </div>
          </div>
        </div>
      </header>

      <div class="visible-scrollbar flex min-h-0 flex-1 flex-col space-y-4 overflow-auto pt-4">
        <div class="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden">
          <label class="block text-sm text-muted-foreground" for="tracing-source">Rust 宏内容</label>
          <Textarea id="tracing-source" v-model="source" data-testid="tracing-input"
            class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
            :placeholder="exampleInput" spellcheck="false" />
        </div>
      </div>
    </section>

    <section
      class="flex min-h-0 min-w-0 flex-col overflow-hidden border-t pt-6 lg:h-full lg:border-t-0 lg:border-l lg:p-6 lg:pt-0">
      <header class="shrink-0">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex justify-between">
              <Badge variant="outline" class="h-fit ">输出结果</Badge>
              <Button type="button" variant="outline" size="icon" :disabled="!output" @click="copyOutput">
                <ClipboardCopy class="h-4 w-4" />
              </Button>
            </div>
            <div>
              <h2 class="text-xl font-semibold tracking-tight">LogQL 模板</h2>
              <p class="mt-2 text-sm text-muted-foreground">
                多条宏会按行生成；字段没有值时，对应片段不会输出。
              </p>
            </div>
          </div>
        </div>
      </header>

      <div class="visible-scrollbar flex min-h-0 flex-1 flex-col space-y-4 overflow-auto pt-4">
        <div class="flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden">
          <label class="block text-sm text-muted-foreground" for="logql-output">模板字符串</label>
          <Textarea id="logql-output" :model-value="output" data-testid="logql-output"
            class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
            readonly />
        </div>

        <Alert v-if="parseResult.error" variant="destructive">
          <AlertTitle>解析失败</AlertTitle>
          <AlertDescription>{{ parseResult.error }}</AlertDescription>
        </Alert>
      </div>
    </section>
    <section
      class="flex min-h-0 min-w-0 flex-col overflow-hidden border-t pt-6 lg:h-full lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
      <header class="shrink-0 space-y-2">
        <Badge variant="secondary">解析详情</Badge>
        <div>
          <h2 class="text-xl font-semibold tracking-tight">字段列表</h2>
        </div>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 overflow-auto pt-4">
        <div v-if="parsedMacros.length" class="grid gap-4">
          <article v-for="(macro, index) in parsedMacros" :key="`${macro.macroName}-${index}`"
            class="space-y-3 rounded-2xl border bg-muted/20 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <Badge>{{ macro.macroName }}!</Badge>
              <Badge variant="outline">第 {{ index + 1 }} 条</Badge>
            </div>

            <dl class="grid gap-3">
              <div v-if="macro.message" class="rounded-2xl border bg-muted/30 px-4 py-3">
                <dt class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Message</dt>
                <dd class="mt-2 text-sm leading-6">{{ macro.message }}</dd>
              </div>
              <div class="flex">
                <Badge v-for="field in macro.fields" :key="field.key" variant="outline" class="ml-1">
                  {{ field.key }}
                </Badge>
              </div>
            </dl>
          </article>
        </div>

        <Alert v-else class="border-dashed bg-transparent">
          <AlertTitle>等待输入</AlertTitle>
          <AlertDescription>
            解析结果会显示在这里。现在它还在等一段合法的宏，就像咖啡机等第一颗豆子。
          </AlertDescription>
        </Alert>
      </div>
    </section>
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
