<script setup lang="ts">
import { computed, ref } from 'vue'

import { parseTracingMacro } from '@/utils/parseTracingMacro'

const exampleInput = `debug!(
    manga_name = manga.name,
    parsed_count = parsed_chapters.len(),
    skipped_count = skipped_count,
    "Search complete for manga, no new chapters"
);`

const source = ref(exampleInput)
const copyStatus = ref('')

const parseResult = computed(() => parseTracingMacro(source.value))
const output = computed(() => parseResult.value.data?.template ?? '')
const parsedData = computed(() => parseResult.value.data)

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

function loadExample() {
  source.value = exampleInput
  copyStatus.value = ''
}
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <article class="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-cyan-300">输入 Rust tracing 宏</p>
          <h2 class="mt-1 text-xl font-semibold text-white">生成 LogQL 模板</h2>
        </div>
        <button
          class="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
          type="button" @click="loadExample">
          载入示例
        </button>
      </div>

      <label class="mb-2 block text-sm text-slate-300" for="tracing-source">Rust 宏内容</label>
      <textarea id="tracing-source" v-model="source" data-testid="tracing-input"
        class="min-h-88 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
        placeholder='把 tracing 宏粘进来，例如 debug!(foo = bar, "done");' spellcheck="false" />

      <p class="mt-3 text-sm leading-6 text-slate-400">
        当前支持
        <code>trace!</code>、<code>debug!</code>、<code>info!</code>、<code>warn!</code>、<code>error!</code>，字段按原始顺序输出；若末尾有字符串消息，则会生成
        <code v-pre>{{.message}}</code> 占位符。
      </p>
    </article>

    <div class="grid gap-6">
      <article class="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/20">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-cyan-700">输出结果</p>
            <h2 class="mt-1 text-xl font-semibold">LogQL 模板</h2>
          </div>
          <button
            class="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button" :disabled="!output" @click="copyOutput">
            复制结果
          </button>
        </div>

        <label class="mb-2 block text-sm text-slate-600" for="logql-output">模板字符串</label>
        <textarea id="logql-output" :value="output" data-testid="logql-output"
          class="min-h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-6 outline-none"
          readonly />

        <p v-if="copyStatus" class="mt-3 text-sm text-slate-500">{{ copyStatus }}</p>
        <p v-if="parseResult.error"
          class="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {{ parseResult.error }}
        </p>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div class="mb-4">
          <p class="text-sm font-medium text-cyan-300">解析详情</p>
          <h2 class="mt-1 text-xl font-semibold text-white">字段列表</h2>
        </div>

        <dl v-if="parsedData" class="grid gap-3">
          <div class="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <dt class="text-xs uppercase tracking-[0.2em] text-slate-400">Macro</dt>
            <dd class="mt-2 font-mono text-sm text-cyan-200">{{ parsedData.macroName }}!</dd>
          </div>

          <div v-if="parsedData.message" class="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <dt class="text-xs uppercase tracking-[0.2em] text-slate-400">Message</dt>
            <dd class="mt-2 text-sm text-slate-200">{{ parsedData.message }}</dd>
          </div>

          <div v-for="field in parsedData.fields" :key="field.key"
            class="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <dt class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ field.key }}</dt>
            <dd class="mt-2 font-mono text-sm text-slate-200">{{ field.expression }}</dd>
          </div>
        </dl>

        <p v-else class="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-slate-400">
          解析结果会显示在这里。现在它还在等一段合法的宏，就像咖啡机等第一颗豆子。
        </p>
      </article>
    </div>
  </section>
</template>
