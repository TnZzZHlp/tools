<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowUpRight, FileStack } from 'lucide-vue-next'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
</script>

<template>
  <div class="space-y-6 pb-8">
    <ToolPageHeader
      title="文件处理"
      description="在浏览器本地安全处理文档，文件不会上传至服务器。"
      :icon="FileStack"
    />

    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li>
        <RouterLink
          to="/tools/files/pdf-merge"
          class="group flex h-full flex-col justify-between rounded-xl border bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div>
            <div class="mb-3.5 flex items-center justify-between gap-3">
              <div
                class="flex size-10 items-center justify-center rounded-lg border bg-muted/60 text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <FileStack class="size-5" />
              </div>
              <div class="flex items-center gap-1.5">
                <Badge variant="secondary" class="font-normal">本地处理</Badge>
                <ArrowUpRight
                  class="size-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                />
              </div>
            </div>
            <h2 class="text-base font-semibold tracking-tight sm:text-lg">PDF 合并与旋转</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              合并多个 PDF，拖拽调整文件顺序，预览并旋转单页或整份文件，全程本地处理。
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
