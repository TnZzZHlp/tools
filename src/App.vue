<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import RouteTransition from '@/components/RouteTransition.vue'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import { findToolByPath, recordRecentTool } from '@/lib/tools'

const route = useRoute()
const isFullscreen = computed(() => route.meta.fullscreen === true)
const shellAppear = ref(false)
const commandOpen = ref(false)

watch(
  () => route.meta.fullscreen === true,
  (fullscreen, previous) => {
    if (previous && !fullscreen) shellAppear.value = true
  },
  { flush: 'sync' },
)

watch(
  () => route.path,
  (path) => {
    recordRecentTool(path)
    const tool = findToolByPath(path)
    if (path === '/') {
      document.title = 'Tools · 实用工具集'
    } else if (path === '/company') {
      document.title = 'Company · Tools'
    } else if (tool) {
      document.title = `${tool.shortName} · Tools`
    }
  },
  { immediate: true },
)
</script>

<template>
  <ThemeProvider default-theme="system">
    <ToastProvider>
      <RouterView v-if="isFullscreen" />
      <div v-else class="flex min-h-[100dvh] flex-col bg-surface text-ink">
        <AppHeader @open-search="commandOpen = true" />

        <main
          class="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
        >
          <RouterView v-slot="{ Component, route: currentRoute }">
            <RouteTransition :route-key="currentRoute.path" :appear="shellAppear">
              <component :is="Component" class="w-full flex-1" />
            </RouteTransition>
          </RouterView>
        </main>

        <AppFooter />
      </div>

      <CommandPalette v-model:open="commandOpen" />
    </ToastProvider>
  </ThemeProvider>
</template>
