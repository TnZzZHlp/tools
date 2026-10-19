<script setup lang="ts">
import { RouterLink } from 'vue-router'
import HoverUnderlineTitle from '@/components/HoverUnderlineTitle.vue'
</script>

<template>
  <section class="space-y-6 overflow-y-auto pb-6">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold">文件处理</h2>
      <p class="text-sm text-muted-foreground">在浏览器中处理文件。</p>
    </div>
    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li>
        <RouterLink
          to="/tools/files/pdf-merge"
          class="group block rounded-xl p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
        >
          <HoverUnderlineTitle class="mb-2">PDF 合并</HoverUnderlineTitle>
          <p class="text-sm leading-relaxed text-muted-foreground">
            合并多个 PDF，调整文件顺序，预览并旋转单页或整份文件，全程本地处理。
          </p>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
