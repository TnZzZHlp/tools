<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Image as ImageIcon, LoaderCircle, Maximize2, RefreshCw } from 'lucide-vue-next'

import { getApiBaseUrl } from '@/api'
import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const loading = ref(false)
const imageSrc = ref('')
const error = ref('')

function preloadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    const finish = (failure?: string) => {
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      if (failure) {
        image.src = ''
        reject(new Error(failure))
      } else resolve(src)
    }
    const timer = window.setTimeout(() => finish('图片加载超时，请稍后重试。'), 20000)
    image.onload = () => finish()
    image.onerror = () => finish('图片暂时无法加载，请稍后重试。')
    image.src = src
  })
}

async function getImage() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  const baseUrl = getApiBaseUrl()
  try {
    imageSrc.value = await preloadImage(`${baseUrl}/yuri/random.jpg?t=${Date.now()}`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '图片加载失败，请重试。'
  } finally {
    loading.value = false
  }
}

onMounted(getImage)
</script>

<template>
  <div class="space-y-5 pb-8">
    <ToolPageHeader
      title="随机图片"
      description="点击画面或右上角按钮随机加载一张插画图片。"
      :icon="ImageIcon"
    >
      <template #actions>
        <Button size="sm" :loading="loading" @click="getImage">
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
          {{ loading ? '正在加载…' : '换一张图片' }}
        </Button>
      </template>
    </ToolPageHeader>

    <Card aria-label="随机 Yuri 图片" :aria-busy="loading">
      <CardHeader>
        <template #title>
          <span class="inline-flex items-center gap-2">
            <ImageIcon class="size-4.5" />
            <span>Yuri 插画</span>
          </span>
        </template>
        <template #action>
          <Dialog>
            <Tooltip>
              <TooltipTrigger as-child>
                <DialogTrigger as-child>
                  <Button
                    variant="secondary"
                    size="sm"
                    class="w-8 px-0"
                    :disabled="!imageSrc"
                    aria-label="放大查看图片"
                  >
                    <Maximize2 class="size-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>放大查看图片</TooltipContent>
            </Tooltip>
            <DialogContent class="w-[min(64rem,calc(100vw-2rem))]">
              <DialogTitle>图片预览</DialogTitle>
              <DialogDescription class="sr-only">随机 Yuri 图片</DialogDescription>
              <img
                :src="imageSrc"
                alt="随机 Yuri 图片放大预览"
                class="mt-3 mx-auto max-h-[75vh] max-w-full rounded-control object-contain"
              />
            </DialogContent>
          </Dialog>
        </template>
      </CardHeader>

      <CardContent class="relative flex min-h-80 items-center justify-center sm:min-h-110">
        <button
          v-if="imageSrc"
          class="flex w-full cursor-pointer items-center justify-center rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
          :disabled="loading"
          aria-label="换一张随机图片"
          @click="getImage"
        >
          <img
            :src="imageSrc"
            alt="随机 Yuri 图片"
            class="max-h-[68vh] max-w-full rounded-control object-contain transition-opacity"
            :class="{ 'opacity-40': loading }"
          />
        </button>
        <p v-else-if="!loading" class="text-[14px] text-ink-muted">暂无图片</p>
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center gap-2 text-[14px] text-ink-muted"
          role="status"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          图片加载中…
        </div>
      </CardContent>
    </Card>

    <Alert v-if="error" variant="danger">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription>{{ error }}</AlertDescription>
        <Button variant="secondary" size="sm" :disabled="loading" @click="getImage">
          重新加载
        </Button>
      </div>
    </Alert>
  </div>
</template>
