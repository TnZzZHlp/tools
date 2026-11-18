<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, ClipboardCopy, RefreshCw, Shuffle, Sparkles } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const CHAR_SETS = {
  digits: '0123456789',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

interface Preset {
  id: string
  label: string
  apply: () => void
}

const useDigits = ref(true)
const useLowercase = ref(true)
const useUppercase = ref(true)
const useSpecial = ref(false)
const length = ref(32)
const count = ref(6)
const excludeChars = ref('')
const uuidMode = ref(false)
const results = ref<string[]>([])
const copySuccess = ref<number | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const presets: Preset[] = [
  {
    id: 'password-16',
    label: '16位强密码',
    apply: () => {
      uuidMode.value = false
      length.value = 16
      useDigits.value = true
      useLowercase.value = true
      useUppercase.value = true
      useSpecial.value = true
      excludeChars.value = '0O1lI'
    },
  },
  {
    id: 'secret-32',
    label: '32位密钥',
    apply: () => {
      uuidMode.value = false
      length.value = 32
      useDigits.value = true
      useLowercase.value = true
      useUppercase.value = true
      useSpecial.value = false
      excludeChars.value = ''
    },
  },
  {
    id: 'token-64',
    label: '64位 Token',
    apply: () => {
      uuidMode.value = false
      length.value = 64
      useDigits.value = true
      useLowercase.value = true
      useUppercase.value = true
      useSpecial.value = false
      excludeChars.value = ''
    },
  },
  {
    id: 'pin-6',
    label: '6位纯数字',
    apply: () => {
      uuidMode.value = false
      length.value = 6
      useDigits.value = true
      useLowercase.value = false
      useUppercase.value = false
      useSpecial.value = false
      excludeChars.value = ''
    },
  },
  {
    id: 'uuid',
    label: 'UUID v4',
    apply: () => {
      uuidMode.value = true
    },
  },
]

const safeLength = computed(() => Math.min(1000, Math.max(1, Number(length.value) || 1)))
const safeCount = computed(() => Math.min(200, Math.max(1, Number(count.value) || 1)))

const charset = computed(() => {
  if (uuidMode.value) return '0123456789abcdef'

  let chars = ''
  if (useDigits.value) chars += CHAR_SETS.digits
  if (useLowercase.value) chars += CHAR_SETS.lowercase
  if (useUppercase.value) chars += CHAR_SETS.uppercase
  if (useSpecial.value) chars += CHAR_SETS.special

  const exclude = excludeChars.value
  if (exclude) {
    chars = [...new Set(chars.split(''))].filter((c) => !exclude.includes(c)).join('')
  }

  return chars
})

const canGenerate = computed(() => {
  if (uuidMode.value) return Number(count.value) > 0
  return charset.value.length > 0 && Number(length.value) > 0 && Number(count.value) > 0
})

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return (array[0] ?? 0) % max
  }
  return Math.floor(Math.random() * max)
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const hex = '0123456789abcdef'
  let uuid = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-'
    } else if (i === 14) {
      uuid += '4'
    } else if (i === 19) {
      uuid += '89ab'[randomInt(4)]
    } else {
      uuid += hex[randomInt(16)]
    }
  }
  return uuid
}

function generateRandomString(len: number, chars: string): string {
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars[randomInt(chars.length)]
  }
  return result
}

function generate() {
  if (!canGenerate.value) {
    results.value = []
    return
  }

  const next: string[] = []
  if (uuidMode.value) {
    for (let i = 0; i < safeCount.value; i++) {
      next.push(generateUUID())
    }
  } else {
    const chars = charset.value
    for (let i = 0; i < safeCount.value; i++) {
      next.push(generateRandomString(safeLength.value, chars))
    }
  }
  results.value = next
  copySuccess.value = null
}

watch(
  [uuidMode, useDigits, useLowercase, useUppercase, useSpecial, length, count, excludeChars],
  () => {
    generate()
  },
  { immediate: true },
)

async function copySingle(index: number) {
  const text = results.value[index]
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = index
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccess.value = null
    }, 1800)
  } catch {
    // Clipboard unavailable
  }
}

async function copyAll() {
  if (!results.value.length) return
  try {
    await navigator.clipboard.writeText(results.value.join('\n'))
    copySuccess.value = -1
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copySuccess.value = null
    }, 1800)
  } catch {
    // Clipboard unavailable
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div class="flex flex-col pb-8">
    <ToolPageHeader
      title="随机字符串生成"
      description="快速生成高强度密码、密钥或标准 UUID v4，点击任意一行结果即可复制。"
      :icon="Shuffle"
    >
      <template #actions>
        <Button type="button" size="sm" :disabled="!canGenerate" @click="generate">
          <RefreshCw class="size-4" />
          重新生成
        </Button>
      </template>
    </ToolPageHeader>

    <div
      class="grid items-start gap-5 lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)]"
    >
      <!-- Configuration Card -->
      <Card>
        <CardHeader class="px-5 pt-5 pb-3">
          <template #title>生成规则</template>
          <template #action>
            <Badge variant="outline" class="font-mono tabular-nums">
              字符池 {{ charset.length }}
            </Badge>
          </template>
          <template #description>
            <div class="mt-2 space-y-1.5">
              <span class="flex items-center gap-1 text-[12px] text-ink-muted">
                <Sparkles class="size-3" />
                常用预设
              </span>
              <div class="flex flex-wrap gap-1.5">
                <Button
                  v-for="preset in presets"
                  :key="preset.id"
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="min-h-7 rounded-full px-2.5 text-[12px]"
                  @click="preset.apply"
                >
                  {{ preset.label }}
                </Button>
              </div>
            </div>
          </template>
        </CardHeader>

        <CardContent class="space-y-5 px-5 pt-2 pb-5">
          <div
            class="flex items-center justify-between rounded-control border border-line bg-surface p-3.5"
          >
            <div class="space-y-0.5 pr-3">
              <Label for="uuid-mode" class="cursor-pointer text-ink">UUID v4 模式</Label>
              <p class="text-[12px] text-ink-muted">生成固定 36 位标准唯一标识符</p>
            </div>
            <Switch id="uuid-mode" v-model="uuidMode" />
          </div>

          <div v-if="!uuidMode" class="space-y-4">
            <div class="space-y-2.5">
              <Label>包含字符类型</Label>
              <div class="grid grid-cols-2 gap-2.5">
                <label
                  for="digits"
                  class="flex cursor-pointer items-center gap-2.5 rounded-control border border-line px-3 py-2.5 text-[14px] text-ink transition-colors hover:bg-control"
                  :class="useDigits && 'bg-surface'"
                >
                  <Checkbox
                    id="digits"
                    :model-value="useDigits"
                    @update:model-value="useDigits = $event === true"
                  />
                  <span>数字 <code class="text-[12px] text-ink-muted">0-9</code></span>
                </label>

                <label
                  for="lowercase"
                  class="flex cursor-pointer items-center gap-2.5 rounded-control border border-line px-3 py-2.5 text-[14px] text-ink transition-colors hover:bg-control"
                  :class="useLowercase && 'bg-surface'"
                >
                  <Checkbox
                    id="lowercase"
                    :model-value="useLowercase"
                    @update:model-value="useLowercase = $event === true"
                  />
                  <span>小写 <code class="text-[12px] text-ink-muted">a-z</code></span>
                </label>

                <label
                  for="uppercase"
                  class="flex cursor-pointer items-center gap-2.5 rounded-control border border-line px-3 py-2.5 text-[14px] text-ink transition-colors hover:bg-control"
                  :class="useUppercase && 'bg-surface'"
                >
                  <Checkbox
                    id="uppercase"
                    :model-value="useUppercase"
                    @update:model-value="useUppercase = $event === true"
                  />
                  <span>大写 <code class="text-[12px] text-ink-muted">A-Z</code></span>
                </label>

                <label
                  for="special"
                  class="flex cursor-pointer items-center gap-2.5 rounded-control border border-line px-3 py-2.5 text-[14px] text-ink transition-colors hover:bg-control"
                  :class="useSpecial && 'bg-surface'"
                >
                  <Checkbox
                    id="special"
                    :model-value="useSpecial"
                    @update:model-value="useSpecial = $event === true"
                  />
                  <span>符号 <code class="text-[12px] text-ink-muted">!@#…</code></span>
                </label>
              </div>
            </div>

            <div class="grid gap-3.5 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="length">字符串长度</Label>
                <Input
                  id="length"
                  v-model.number="length"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="32"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="exclude">排除易混字符</Label>
                <Input
                  id="exclude"
                  v-model="excludeChars"
                  placeholder="例如: 0O1lI"
                  class="font-mono"
                />
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="count">生成条数（1 - 200）</Label>
            <Input
              id="count"
              v-model.number="count"
              type="number"
              min="1"
              max="200"
              placeholder="6"
            />
          </div>

          <Button class="w-full" :disabled="!canGenerate" @click="generate">
            <RefreshCw class="size-4" />
            换一批结果
          </Button>
        </CardContent>
      </Card>

      <!-- Results Card -->
      <Card class="min-w-0">
        <CardHeader class="px-5 pt-5 pb-3">
          <template #title>
            <span class="inline-flex items-center gap-2">
              <span>生成结果</span>
              <Badge v-if="results.length" variant="neutral" class="tabular-nums">
                {{ results.length }} 条 · {{ uuidMode ? 36 : safeLength }} 位
              </Badge>
            </span>
          </template>
          <template #action>
            <Button
              v-if="results.length"
              type="button"
              variant="secondary"
              size="sm"
              :class="copySuccess === -1 && 'text-accent'"
              @click="copyAll"
            >
              <Check v-if="copySuccess === -1" class="size-4" />
              <ClipboardCopy v-else class="size-4" />
              {{ copySuccess === -1 ? '已复制全部' : '复制全部' }}
            </Button>
          </template>
        </CardHeader>

        <CardContent class="px-5 pt-2 pb-5">
          <ul v-if="results.length" class="space-y-2">
            <li v-for="(result, index) in results" :key="index">
              <button
                type="button"
                class="group flex w-full items-center gap-3 rounded-control border border-line bg-surface px-3.5 py-2.5 text-left outline-none transition-[border-color,background-color] duration-[var(--p0seid0n-duration-fast)] hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
                :class="copySuccess === index && 'border-accent'"
                :aria-label="`复制第 ${index + 1} 条字符串`"
                @click="copySingle(index)"
              >
                <span class="w-5 shrink-0 font-mono text-[12px] tabular-nums text-ink-muted">
                  {{ index + 1 }}
                </span>
                <code
                  class="min-w-0 flex-1 break-all font-mono text-[14px] leading-relaxed text-ink"
                >
                  {{ result }}
                </code>
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] transition-colors"
                  :class="
                    copySuccess === index
                      ? 'font-medium text-accent'
                      : 'text-ink-muted group-hover:bg-raised group-hover:text-ink'
                  "
                >
                  <Check v-if="copySuccess === index" class="size-3.5" />
                  <ClipboardCopy v-else class="size-3.5" />
                  <span class="hidden sm:inline">{{
                    copySuccess === index ? '已复制' : '复制'
                  }}</span>
                </span>
              </button>
            </li>
          </ul>

          <div
            v-else
            class="flex min-h-56 flex-col items-center justify-center rounded-control border border-dashed border-line p-6 text-center text-[14px] text-ink-muted"
          >
            <p>请至少开启一种字符类型（或调整排除字符）以生成结果。</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
