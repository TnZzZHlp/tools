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
    <div class="grid gap-6 md:grid-cols-2 md:divide-x-2 xl:grid-cols-3 xl:divide-x-3">
      <div
        v-for="tool in tools"
        :key="tool.to"
        class="bg-card text-card-foreground group flex cursor-pointer flex-col gap-6 rounded-xl py-6"
        @click="$router.push(tool.to)"
      >
        <div class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <HoverUnderlineTitle>{{ tool.name }}</HoverUnderlineTitle>
          </div>
          <p class="text-muted-foreground text-sm">{{ tool.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
