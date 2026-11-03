<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getApiBaseUrl } from '@/api'
import { LoaderCircle, Image, RefreshCw, Maximize2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

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
  <section class="visible-scrollbar h-full space-y-6 overflow-y-auto pb-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-semibold tracking-tight">随机图片</h1>
      <Button :disabled="loading" @click="getImage"
        ><RefreshCw :class="{ 'animate-spin': loading }" />{{
          loading ? '正在加载' : '换一张图片'
        }}</Button
      >
    </div>
    <Card aria-label="随机 Yuri 图片" :aria-busy="loading">
      <CardHeader
        ><CardTitle class="flex items-center gap-2"><Image class="size-5" />Yuri</CardTitle
        ><CardAction>
          <Dialog>
            <Tooltip
              ><TooltipTrigger as-child
                ><DialogTrigger as-child
                  ><Button
                    variant="outline"
                    size="icon"
                    :disabled="!imageSrc"
                    aria-label="放大查看图片"
                    ><Maximize2 /></Button></DialogTrigger></TooltipTrigger
              ><TooltipContent>放大查看图片</TooltipContent></Tooltip
            >
            <DialogContent class="sm:max-w-5xl"
              ><DialogHeader
                ><DialogTitle>图片预览</DialogTitle
                ><DialogDescription class="sr-only">随机 Yuri 图片</DialogDescription></DialogHeader
              ><img
                :src="imageSrc"
                alt="随机 Yuri 图片放大预览"
                class="mx-auto max-h-[75vh] max-w-full object-contain"
            /></DialogContent>
          </Dialog> </CardAction
      ></CardHeader>
      <CardContent class="relative flex min-h-80 items-center justify-center sm:min-h-110">
        <button
          v-if="imageSrc"
          class="flex w-full items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :disabled="loading"
          aria-label="换一张随机图片"
          @click="getImage"
        >
          <img
            :src="imageSrc"
            alt="随机 Yuri 图片"
            class="max-h-[65vh] max-w-full rounded-md object-contain"
            :class="{ 'opacity-40': loading }"
          />
        </button>
        <p v-else-if="!loading" class="text-sm text-muted-foreground">暂无图片</p>
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />图片加载中…
        </div>
      </CardContent>
    </Card>
    <Alert v-if="error" variant="destructive"
      ><AlertDescription class="flex flex-wrap items-center justify-between gap-3"
        ><span>{{ error }}</span
        ><Button variant="outline" :disabled="loading" @click="getImage"
          >重新加载</Button
        ></AlertDescription
      ></Alert
    >
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
