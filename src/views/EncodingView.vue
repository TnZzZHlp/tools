<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ArrowLeftRight, Binary, Check, ClipboardCopy, Eraser, Sparkles } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { decodeUnicode, encodeUnicode } from '@/utils/unicodeCodec'

type CopyTarget = 'plain' | 'encoded'

const SAMPLE_TEXT = '你好，世界 👋 Hello Unicode!'

const plainText = ref('')
const encodedText = ref('')
const copiedTarget = ref<CopyTarget | null>(null)

let copyTimer: ReturnType<typeof setTimeout> | undefined

function updateFromPlain(value: string) {
  plainText.value = value
  encodedText.value = encodeUnicode(plainText.value)
}

function updateFromEncoded(value: string) {
  encodedText.value = value
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
        <Button type="button" variant="secondary" size="sm" @click="fillSample">
          <Sparkles class="size-4" />
          填入示例
        </Button>
        <Button
          type="button"
          variant="ghost"
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
      <Card class="min-h-64 min-w-0 lg:min-h-0">
        <CardHeader class="px-4 pt-4 pb-2">
          <template #title>
            <span class="inline-flex items-center gap-2">
              <label for="unicode-plain-text">原始文本</label>
              <Badge variant="neutral" class="font-mono tabular-nums">
                {{ plainText.length }} 字符
              </Badge>
            </span>
          </template>
          <template #action>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="!plainText"
              :aria-label="copiedTarget === 'plain' ? '原始文本已复制' : '复制原始文本'"
              :class="copiedTarget === 'plain' && 'text-accent'"
              @click="copyText('plain')"
            >
              <Check v-if="copiedTarget === 'plain'" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copiedTarget === 'plain' ? '已复制' : '复制' }}
            </Button>
          </template>
        </CardHeader>
        <CardContent class="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4">
          <Textarea
            id="unicode-plain-text"
            :model-value="plainText"
            class="h-full min-h-48 flex-1 resize-none font-mono text-[14px] leading-6 lg:min-h-0"
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
          class="flex size-9 items-center justify-center rounded-full border border-line bg-raised text-ink-muted"
        >
          <ArrowLeftRight class="size-4" />
        </div>
      </div>

      <!-- Encoded Text Card -->
      <Card class="min-h-64 min-w-0 lg:min-h-0">
        <CardHeader class="px-4 pt-4 pb-2">
          <template #title>
            <span class="inline-flex items-center gap-2">
              <label for="unicode-encoded-text">Unicode 转义序列</label>
              <Badge variant="outline" class="font-mono tabular-nums">
                {{ encodedText.length }} 字符
              </Badge>
            </span>
          </template>
          <template #action>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="!encodedText"
              :aria-label="copiedTarget === 'encoded' ? 'Unicode 编码已复制' : '复制 Unicode 编码'"
              :class="copiedTarget === 'encoded' && 'text-accent'"
              @click="copyText('encoded')"
            >
              <Check v-if="copiedTarget === 'encoded'" class="size-3.5" />
              <ClipboardCopy v-else class="size-3.5" />
              {{ copiedTarget === 'encoded' ? '已复制' : '复制' }}
            </Button>
          </template>
        </CardHeader>
        <CardContent class="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4">
          <Textarea
            id="unicode-encoded-text"
            :model-value="encodedText"
            class="h-full min-h-48 flex-1 resize-none font-mono text-[14px] leading-6 lg:min-h-0"
            placeholder="在此输入 Unicode 转义序列，例如：\u4F60\u597D"
            spellcheck="false"
            @update:model-value="updateFromEncoded"
          />
        </CardContent>
      </Card>
    </div>
  </div>
</template>
