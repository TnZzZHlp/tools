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
          class="group flex h-full flex-col justify-between rounded-panel border border-line bg-raised p-5 outline-none transition-[border-color,transform,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-out-expo hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-line))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
        >
          <div>
            <div class="mb-3.5 flex items-center justify-between gap-3">
              <div
                class="flex size-10 items-center justify-center rounded-control border border-line bg-control text-ink transition-colors duration-[var(--p0seid0n-duration-normal)] group-hover:border-ink group-hover:bg-ink group-hover:text-surface"
              >
                <FileStack class="size-5" />
              </div>
              <div class="flex items-center gap-1.5">
                <Badge variant="neutral">本地处理</Badge>
                <ArrowUpRight
                  class="size-4 text-ink-faint transition-[transform,color] duration-[var(--p0seid0n-duration-normal)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                />
              </div>
            </div>
            <h2 class="text-[16px] font-semibold tracking-tight text-ink sm:text-[17px]">
              PDF 合并与旋转
            </h2>
            <p class="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
              合并多个 PDF，拖拽调整文件顺序，预览并旋转单页或整份文件，全程本地处理。
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
