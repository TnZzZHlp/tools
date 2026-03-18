<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { RouterView, useRoute } from 'vue-router'
import { ChevronLeft, Moon, Sun } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'

const $route = useRoute()

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
    <div
      class="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
    >
      <header class="mb-4 flex flex-col gap-3 border-b pb-4 sm:mb-6 sm:gap-4 sm:pb-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Button
              v-if="$route.path !== '/'"
              variant="ghost"
              size="icon"
              class="shrink-0 sm:hidden"
              aria-label="返回"
              @click="$router.push('/')"
            >
              <ChevronLeft class="h-5 w-5" />
            </Button>
            <h1
              class="text-2xl font-semibold tracking-tight cursor-pointer sm:text-3xl"
              @click="$router.push('/')"
            >
              Tools
            </h1>
          </div>

          <nav class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              @click="toggleTheme"
              :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
            >
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
