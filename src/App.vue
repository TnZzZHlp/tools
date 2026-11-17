<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppFooter from '@/components/AppFooter.vue'
import RouteTransition from '@/components/RouteTransition.vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ChevronLeft, Moon, Sun } from 'lucide-vue-next'
import { computed, ref, onMounted, watch } from 'vue'

const $route = useRoute()
const router = useRouter()
const isFullscreen = computed(() => $route.meta.fullscreen === true)
const shellAppear = ref(false)

watch(
  () => $route.meta.fullscreen === true,
  (fullscreen, previous) => {
    if (previous && !fullscreen) shellAppear.value = true
  },
  { flush: 'sync' },
)

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
  <TooltipProvider :delay-duration="250">
    <RouterView v-if="isFullscreen" />
    <div v-else class="h-screen min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div
        class="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden px-3 py-2 sm:px-6 sm:py-3 lg:px-8"
      >
        <header class="mb-3 shrink-0 border-b pb-2" style="view-transition-name: app-header">
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
                class="cursor-pointer text-xl font-semibold tracking-tight"
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
          <RouterView v-slot="{ Component, route }">
            <RouteTransition :route-key="route.path" :appear="shellAppear" :router="router">
              <component :is="Component" class="min-h-0 w-full flex-1" />
            </RouteTransition>
          </RouterView>
        </main>

        <AppFooter />
      </div>
    </div>
  </TooltipProvider>
</template>
