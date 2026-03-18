<script setup lang="ts">
import HoverUnderlineTitle from '@/components/HoverUnderlineTitle.vue'

const tools = [
  {
    name: 'Rust tracing → LogQL',
    description: '提取 Rust tracing 宏并且生成适合 Loki / LogQL 使用的模板字符串。',
    to: '/tools/rust-tracing-to-logql',
  },
]
</script>

<template>
  <section class="space-y-6">
    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="tool in tools"
        :key="tool.to"
        class="group cursor-pointer rounded-xl p-6 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabindex="0"
        role="link"
        @click="$router.push(tool.to)"
        @keydown.enter="$router.push(tool.to)"
        @keydown.space.prevent="$router.push(tool.to)"
      >
        <HoverUnderlineTitle class="mb-2">{{ tool.name }}</HoverUnderlineTitle>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ tool.description }}</p>
      </li>
    </ul>
  </section>
</template>
