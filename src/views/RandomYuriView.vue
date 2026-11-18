<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Image as ImageIcon, LoaderCircle, Maximize2, RefreshCw } from 'lucide-vue-next'

import { getApiBaseUrl } from '@/api'
import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
        <Button :disabled="loading" @click="getImage">
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
          {{ loading ? '正在加载…' : '换一张图片' }}
        </Button>
      </template>
    </ToolPageHeader>

    <Card aria-label="随机 Yuri 图片" :aria-busy="loading">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <ImageIcon class="size-4.5" />
          Yuri 插画
        </CardTitle>
        <CardAction>
          <Dialog>
            <Tooltip>
              <TooltipTrigger as-child>
                <DialogTrigger as-child>
                  <Button
                    variant="outline"
                    size="icon"
                    class="size-8"
                    :disabled="!imageSrc"
                    aria-label="放大查看图片"
                  >
                    <Maximize2 class="size-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>放大查看图片</TooltipContent>
            </Tooltip>
            <DialogContent class="sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>图片预览</DialogTitle>
                <DialogDescription class="sr-only">随机 Yuri 图片</DialogDescription>
              </DialogHeader>
              <img
                :src="imageSrc"
                alt="随机 Yuri 图片放大预览"
                class="mx-auto max-h-[75vh] max-w-full rounded-md object-contain"
              />
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>

      <CardContent class="relative flex min-h-80 items-center justify-center sm:min-h-110">
        <button
          v-if="imageSrc"
          class="flex w-full cursor-pointer items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :disabled="loading"
          aria-label="换一张随机图片"
          @click="getImage"
        >
          <img
            :src="imageSrc"
            alt="随机 Yuri 图片"
            class="max-h-[68vh] max-w-full rounded-lg object-contain transition-opacity"
            :class="{ 'opacity-40': loading }"
          />
        </button>
        <p v-else-if="!loading" class="text-sm text-muted-foreground">暂无图片</p>
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          图片加载中…
        </div>
      </CardContent>
    </Card>

    <Alert v-if="error" variant="destructive">
      <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ error }}</span>
        <Button variant="outline" size="sm" :disabled="loading" @click="getImage">
          重新加载
        </Button>
      </AlertDescription>
    </Alert>
  </div>
</template>
