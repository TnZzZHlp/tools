<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PdfMergeTool from '@/components/pdf/PdfMergeTool.vue'
</script>

<template>
  <section class="space-y-5 overflow-y-auto pb-6">
    <RouterLink to="/tools/files" class="text-sm text-muted-foreground underline underline-offset-4"
      >返回文件处理</RouterLink
    >
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold">PDF 合并</h2>
      <p class="text-sm text-muted-foreground">选择文件，调整顺序和页面方向，然后合并下载。</p>
    </div>
    <PdfMergeTool />
  </section>
</template>
