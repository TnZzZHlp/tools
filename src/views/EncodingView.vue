<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ArrowLeftRight, Binary, Check, ClipboardCopy, Eraser, Sparkles } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { decodeUnicode, encodeUnicode } from '@/utils/unicodeCodec'

type CopyTarget = 'plain' | 'encoded'

const SAMPLE_TEXT = '你好，世界 👋 Hello Unicode!'

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

function fillSample() {
  updateFromPlain(SAMPLE_TEXT)
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
    }, 1800)
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
  <div class="flex flex-col pb-6">
    <ToolPageHeader
      title="Unicode 编码解码"
      description="编辑任意一侧即可实时双向转换，完整支持 \uXXXX 与 \u{XXXXX}（含 Emoji 扩展字符）。"
      badge="实时双向"
      :icon="Binary"
    >
      <template #actions>
        <Button type="button" variant="outline" size="sm" @click="fillSample">
          <Sparkles class="size-4" />
          填入示例
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="!plainText && !encodedText"
          @click="clearAll"
        >
          <Eraser class="size-4" />
          清空
        </Button>
      </template>
    </ToolPageHeader>

    <div
      class="grid gap-4 lg:h-[calc(100dvh-11.5rem)] lg:min-h-[26rem] lg:grid-cols-[1fr_auto_1fr]"
    >
      <!-- Plain Text Card -->
      <Card class="flex min-h-64 min-w-0 flex-col gap-3 py-4 lg:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <CardTitle class="text-sm font-semibold sm:text-base">
                <label for="unicode-plain-text">原始文本</label>
              </CardTitle>
              <Badge variant="secondary" class="font-mono text-xs font-normal tabular-nums">
                {{ plainText.length }} 字符
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 text-xs"
              :disabled="!plainText"
              :aria-label="copiedTarget === 'plain' ? '原始文本已复制' : '复制原始文本'"
              :class="copiedTarget === 'plain' && 'text-emerald-600 dark:text-emerald-400'"
              @click="copyText('plain')"
            >
              <Check v-if="copiedTarget === 'plain'" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copiedTarget === 'plain' ? '已复制' : '复制' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent class="flex min-h-0 flex-1 flex-col px-4">
          <Textarea
            id="unicode-plain-text"
            :model-value="plainText"
            class="h-full min-h-48 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 lg:min-h-0"
            placeholder="在此输入或粘贴任意文本，例如：你好，世界 👋"
            spellcheck="false"
            autofocus
            @update:model-value="updateFromPlain"
          />
        </CardContent>
      </Card>

      <!-- Bidirectional Indicator -->
      <div class="hidden items-center justify-center lg:flex" aria-hidden="true">
        <div
          class="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-2xs"
        >
          <ArrowLeftRight class="size-4" />
        </div>
      </div>

      <!-- Encoded Text Card -->
      <Card class="flex min-h-64 min-w-0 flex-col gap-3 py-4 lg:min-h-0">
        <CardHeader class="px-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <CardTitle class="text-sm font-semibold sm:text-base">
                <label for="unicode-encoded-text">Unicode 转义序列</label>
              </CardTitle>
              <Badge variant="outline" class="font-mono text-xs font-normal tabular-nums">
                {{ encodedText.length }} 字符
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 text-xs"
              :disabled="!encodedText"
              :aria-label="copiedTarget === 'encoded' ? 'Unicode 编码已复制' : '复制 Unicode 编码'"
              :class="copiedTarget === 'encoded' && 'text-emerald-600 dark:text-emerald-400'"
              @click="copyText('encoded')"
            >
              <Check v-if="copiedTarget === 'encoded'" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copiedTarget === 'encoded' ? '已复制' : '复制' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent class="flex min-h-0 flex-1 flex-col px-4">
          <Textarea
            id="unicode-encoded-text"
            :model-value="encodedText"
            class="h-full min-h-48 flex-1 resize-none bg-muted/20 font-mono text-sm leading-6 lg:min-h-0"
            placeholder="在此输入 Unicode 转义序列，例如：\u4F60\u597D"
            spellcheck="false"
            @update:model-value="updateFromEncoded"
          />
        </CardContent>
      </Card>
    </div>
  </div>
</template>
