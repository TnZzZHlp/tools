<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="h-screen overflow-hidden bg-background text-foreground">
    <div class="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden px-6 py-10 lg:px-8">
      <header class="mb-8 flex flex-col gap-4 border-b pb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-3">
            <div>
              <h1 class="text-3xl font-semibold tracking-tight cursor-pointer" @click="$router.push('/')">Tools</h1>
            </div>
          </div>

          <nav class="flex items-center gap-3">
            <!-- 暗色切换按钮 -->
            <Button variant="ghost" size="icon" @click="$emit('toggle-theme')">
              <Sun class="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>

      <main class="flex min-h-0 flex-1 overflow-hidden">
        <RouterView v-slot="{ Component }">
          <component :is="Component" class="min-h-0 w-full flex-1" />
        </RouterView>
      </main>
    </div>
  </div>
</template>
