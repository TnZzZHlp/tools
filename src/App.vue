<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { RouterView } from 'vue-router'
import { Moon, Sun } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'

const isDark = ref(false)

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}
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
            <Button variant="ghost" size="icon" @click="toggleTheme" :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'">
              <Sun v-if="isDark" class="h-4 w-4" />
              <Moon v-else class="h-4 w-4" />
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
