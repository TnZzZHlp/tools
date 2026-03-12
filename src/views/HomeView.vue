<script setup lang="ts">
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="tool in tools" :key="tool.to" @click="$router.push(tool.to)" class="cursor-pointer">
        <CardHeader class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <CardTitle class="text-xl">{{ tool.name }}</CardTitle>
          </div>
          <CardDescription>{{ tool.description }}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  </section>
</template>
