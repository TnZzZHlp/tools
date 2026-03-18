<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Check, ClipboardCopy, RefreshCw } from 'lucide-vue-next'

const CHAR_SETS = {
  digits: '0123456789',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

const useDigits = ref(true)
const useLowercase = ref(true)
const useUppercase = ref(true)
const useSpecial = ref(false)
const length = ref(64)
const count = ref(5)
const excludeChars = ref('')
const uuidMode = ref(false)
const results = ref<string[]>([])
const copySuccess = ref<number | null>(null)

watch(uuidMode, (isUuid) => {
  if (isUuid) {
    length.value = 64
    useDigits.value = true
    useLowercase.value = true
    useUppercase.value = false
    useSpecial.value = false
  }
})

const charset = computed(() => {
  if (uuidMode.value) {
    return '0123456789abcdef'
  }

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
  if (uuidMode.value) return true
  return charset.value.length > 0 && length.value > 0 && count.value > 0
})

function generateUUID(): string {
  const hex = '0123456789abcdef'
  let uuid = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-'
    } else if (i === 14) {
      uuid += '4'
    } else if (i === 19) {
      uuid += '89ab'[Math.floor(Math.random() * 4)]
    } else {
      uuid += hex[Math.floor(Math.random() * 16)]
    }
  }
  return uuid
}

function generateRandomString(len: number, chars: string): string {
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generate() {
  results.value = []

  if (uuidMode.value) {
    for (let i = 0; i < count.value; i++) {
      results.value.push(generateUUID())
    }
    return
  }

  const chars = charset.value
  if (!chars) return

  for (let i = 0; i < count.value; i++) {
    results.value.push(generateRandomString(length.value, chars))
  }
}

async function copySingle(index: number) {
  const text = results.value[index]
  if (!text) return

  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = index
    setTimeout(() => {
      copySuccess.value = null
    }, 2000)
  } catch {
    console.error('Failed to copy')
  }
}

async function copyAll() {
  try {
    await navigator.clipboard.writeText(results.value.join('\n'))
    copySuccess.value = -1
    setTimeout(() => {
      copySuccess.value = null
    }, 2000)
  } catch {
    console.error('Failed to copy')
  }
}
</script>

<template>
  <section class="grid h-full w-full min-h-0 gap-4 overflow-hidden lg:grid-cols-2 lg:gap-6">
    <section class="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <header class="shrink-0 space-y-1.5 sm:space-y-2">
        <Badge variant="secondary">配置选项</Badge>
        <h2 class="text-lg font-semibold tracking-tight sm:text-xl">随机字符串生成器</h2>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 overflow-auto pt-4 sm:pt-6">
        <div class="space-y-6">
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label for="uuid-mode">UUID 模式</Label>
              <p class="text-sm text-muted-foreground">生成标准 UUID v4 格式</p>
            </div>
            <Switch id="uuid-mode" v-model="uuidMode" />
          </div>

          <div v-if="!uuidMode" class="space-y-4">
            <div class="space-y-3">
              <Label>字符类型</Label>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="flex items-center gap-2">
                  <Checkbox id="digits" v-model="useDigits" :disabled="uuidMode" />
                  <Label for="digits" :class="['cursor-pointer', uuidMode && 'opacity-50']">数字</Label>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox id="lowercase" v-model="useLowercase" :disabled="uuidMode" />
                  <Label for="lowercase" :class="['cursor-pointer', uuidMode && 'opacity-50']">小写</Label>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox id="uppercase" v-model="useUppercase" :disabled="uuidMode" />
                  <Label for="uppercase" :class="['cursor-pointer', uuidMode && 'opacity-50']">大写</Label>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox id="special" v-model="useSpecial" :disabled="uuidMode" />
                  <Label for="special" :class="['cursor-pointer', uuidMode && 'opacity-50']">特殊</Label>
                </div>
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="length">字符串长度</Label>
                <Input id="length" v-model.number="length" type="number" min="1" max="1000" placeholder="64"
                  :disabled="uuidMode" :class="uuidMode && 'bg-muted'" />
              </div>

              <div class="space-y-2">
                <Label for="exclude">排除字符</Label>
                <Input id="exclude" v-model="excludeChars" placeholder="例如: 0O1lI" :disabled="uuidMode"
                  :class="uuidMode && 'bg-muted'" />
              </div>
            </div>
          </div>

          <div v-else class="space-y-2">
            <Label for="uuid-length">字符串长度</Label>
            <Input id="uuid-length" :model-value="36" type="number" disabled class="bg-muted" />
          </div>

          <div class="space-y-2">
            <Label for="count">生成数量</Label>
            <Input id="count" v-model.number="count" type="number" min="1" max="1000" placeholder="5" />
          </div>

          <Button class="w-full" :disabled="!canGenerate" @click="generate">
            <RefreshCw class="h-4 w-4" />
            生成随机字符串
          </Button>
        </div>
      </div>
    </section>

    <section
      class="flex min-h-0 min-w-0 flex-col overflow-hidden border-t pt-4 lg:h-full lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
      <header class="shrink-0">
        <div class="flex items-center justify-between">
          <div class="space-y-1.5 sm:space-y-2">
            <Badge variant="outline">输出结果</Badge>
            <h2 class="text-lg font-semibold tracking-tight sm:text-xl">
              生成结果
              <span v-if="results.length" class="text-sm font-normal text-muted-foreground">
                ({{ results.length }} 条)
              </span>
            </h2>
          </div>
          <Button v-if="results.length > 1" variant="outline" size="sm"
            :class="copySuccess === -1 && 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400'"
            @click="copyAll">
            <Check v-if="copySuccess === -1" class="h-4 w-4" />
            <ClipboardCopy v-else class="h-4 w-4" />
            复制全部
          </Button>
        </div>
      </header>

      <div class="visible-scrollbar min-h-0 flex-1 overflow-auto pt-4">
        <div v-if="results.length" class="space-y-2">
          <div v-for="(result, index) in results" :key="index"
            class="group flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <code class="flex-1 break-all font-mono text-sm">{{ result }}</code>
            <Button variant="ghost" size="icon" class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              :class="copySuccess === index && 'opacity-100 text-green-600 dark:text-green-400'"
              @click="copySingle(index)">
              <Check v-if="copySuccess === index" class="h-4 w-4" />
              <ClipboardCopy v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div v-else class="flex h-full items-center justify-center text-muted-foreground">
          <p>点击"生成随机字符串"开始</p>
        </div>
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
