<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Check, ClipboardCopy, Eraser, MoveRight } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { decodeUnicode, encodeUnicode } from '@/utils/unicodeCodec'

type CopyTarget = 'plain' | 'encoded'

const plainText = ref('')
const encodedText = ref('')
const copiedTarget = ref<CopyTarget | null>(null)

let copyTimer: ReturnType<typeof setTimeout> | undefined

function updateFromPlain(value: string | number) {
  plainText.value = String(value)
  encodedText.value = encodeUnicode(plainText.value)
}

function updateFromEncoded(value: string | number) {
  encodedText.value = String(value)
  plainText.value = decodeUnicode(encodedText.value)
}

function clearAll() {
  plainText.value = ''
  encodedText.value = ''
  copiedTarget.value = null
}

async function copyText(target: CopyTarget) {
  const value = target === 'plain' ? plainText.value : encodedText.value
  if (!value) return

  try {
    await navigator.clipboard.writeText(value)
    copiedTarget.value = target
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedTarget.value = null
    }, 2000)
  } catch {
    const textarea = document.querySelector(
      target === 'plain' ? '#unicode-plain-text' : '#unicode-encoded-text',
    ) as HTMLTextAreaElement | null
    textarea?.select()
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <section class="flex h-full min-h-0 w-full flex-col overflow-hidden">
    <header class="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div class="space-y-1.5 sm:space-y-2">
        <div class="flex items-center gap-2">
          <Badge variant="secondary">编码解码</Badge>
          <Badge variant="outline">Unicode</Badge>
        </div>
        <div>
          <h2 class="text-lg font-semibold tracking-tight sm:text-xl">Unicode 转换</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:mt-2">
            编辑任意一侧都会自动转换；支持
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">\uXXXX</code>
            和
            <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">\u{XXXXX}</code>
            解码。
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="!plainText && !encodedText"
        @click="clearAll"
      >
        <Eraser class="h-4 w-4" />
        清空
      </Button>
    </header>

    <div class="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
      <section class="flex min-h-64 min-w-0 flex-col overflow-hidden lg:min-h-0">
        <div class="mb-2 flex shrink-0 items-center justify-between gap-3">
          <label class="text-sm font-medium" for="unicode-plain-text">原始文本</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :disabled="!plainText"
            :aria-label="copiedTarget === 'plain' ? '原始文本已复制' : '复制原始文本'"
            :class="copiedTarget === 'plain' && 'text-green-600 dark:text-green-400'"
            @click="copyText('plain')"
          >
            <Check v-if="copiedTarget === 'plain'" class="h-4 w-4" />
            <ClipboardCopy v-else class="h-4 w-4" />
            {{ copiedTarget === 'plain' ? '已复制' : '复制' }}
          </Button>
        </div>
        <Textarea
          id="unicode-plain-text"
          :model-value="plainText"
          class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
          placeholder="在此输入文本，例如：你好，世界 👋"
          spellcheck="false"
          autofocus
          @update:model-value="updateFromPlain"
        />
      </section>

      <div class="hidden items-center justify-center lg:flex" aria-hidden="true">
        <div class="rounded-full border bg-background p-2 text-muted-foreground">
          <MoveRight class="h-4 w-4" />
        </div>
      </div>

      <section
        class="flex min-h-64 min-w-0 flex-col overflow-hidden border-t pt-4 lg:min-h-0 lg:border-t-0 lg:pt-0"
      >
        <div class="mb-2 flex shrink-0 items-center justify-between gap-3">
          <label class="text-sm font-medium" for="unicode-encoded-text">Unicode 编码</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :disabled="!encodedText"
            :aria-label="copiedTarget === 'encoded' ? 'Unicode 编码已复制' : '复制 Unicode 编码'"
            :class="copiedTarget === 'encoded' && 'text-green-600 dark:text-green-400'"
            @click="copyText('encoded')"
          >
            <Check v-if="copiedTarget === 'encoded'" class="h-4 w-4" />
            <ClipboardCopy v-else class="h-4 w-4" />
            {{ copiedTarget === 'encoded' ? '已复制' : '复制' }}
          </Button>
        </div>
        <Textarea
          id="unicode-encoded-text"
          :model-value="encodedText"
          class="visible-scrollbar h-full min-h-0 flex-1 resize-none overflow-auto font-mono text-sm leading-6"
          placeholder="在此输入 Unicode 编码，例如：\u4F60\u597D"
          spellcheck="false"
          @update:model-value="updateFromEncoded"
        />
      </section>
    </div>
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
  border-radius: 9999px;
  background: color-mix(in oklab, var(--muted-foreground) 35%, transparent);
}
</style>
