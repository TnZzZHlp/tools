<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Blocks, ChevronLeft, ChevronRight, Monitor, Moon, Search, Sun } from 'lucide-vue-next'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useTheme } from '@/composables/useTheme'
import { resolveBackTarget, resolveRouteBreadcrumbs } from '@/lib/tools'

const emit = defineEmits<{
  openSearch: []
}>()

const route = useRoute()
const router = useRouter()
// Keep theme-color meta synced across all pages
useTheme()

const isHome = computed(() => route.path === '/')
const breadcrumbs = computed(() => resolveRouteBreadcrumbs(route.path))
const currentCrumbLabel = computed(
  () => breadcrumbs.value[breadcrumbs.value.length - 1]?.label ?? 'Tools',
)
const backTarget = computed(() => resolveBackTarget(route.path))

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

const themeLabels = {
  system: '跟随系统',
  light: '浅色模式',
  dark: '深色模式',
} as const
</script>

<template>
  <header
    class="sticky top-0 z-40 shrink-0 border-b border-line bg-[color-mix(in_oklab,var(--color-surface)_86%,transparent)] backdrop-blur-md"
  >
    <div
      class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
    >
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          v-if="!isHome"
          variant="ghost"
          size="sm"
          class="w-8 shrink-0 px-0 sm:hidden"
          aria-label="返回上一级"
          @click="router.push(backTarget)"
        >
          <ChevronLeft class="size-4.5" />
        </Button>

        <RouterLink
          to="/"
          class="group flex shrink-0 items-center gap-2 rounded-[10px] py-1 pr-1.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
        >
          <span
            class="flex size-7 items-center justify-center rounded-[9px] bg-ink text-surface transition-transform duration-[var(--p0seid0n-duration-fast)] ease-spring group-hover:scale-[1.03]"
          >
            <Blocks class="size-4" />
          </span>
          <span class="font-condensed text-[20px] leading-none font-medium tracking-[-0.01em]">
            Tools
          </span>
        </RouterLink>

        <span v-if="!isHome" class="truncate text-[13px] font-medium text-ink-muted sm:hidden">
          / {{ currentCrumbLabel }}
        </span>

        <Breadcrumb
          v-if="!isHome && breadcrumbs.length"
          aria-label="面包屑导航"
          class="hidden min-w-0 sm:block"
        >
          <BreadcrumbList class="flex-nowrap gap-1 sm:gap-1">
            <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
              <BreadcrumbSeparator>
                <ChevronRight class="size-3.5 shrink-0" />
              </BreadcrumbSeparator>
              <BreadcrumbItem class="min-w-0">
                <BreadcrumbLink v-if="crumb.to" as-child>
                  <RouterLink :to="crumb.to" class="px-1.5 py-0.5">
                    {{ crumb.label }}
                  </RouterLink>
                </BreadcrumbLink>
                <BreadcrumbPage
                  v-else-if="index === breadcrumbs.length - 1"
                  class="truncate px-1.5 py-0.5"
                >
                  {{ crumb.label }}
                </BreadcrumbPage>
                <span v-else class="truncate px-1.5 py-0.5 text-ink-muted">
                  {{ crumb.label }}
                </span>
              </BreadcrumbItem>
            </template>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="hidden w-52 justify-between gap-2 px-2.5 text-[12px] font-normal text-ink-muted hover:text-ink sm:inline-flex lg:w-60"
          @click="emit('openSearch')"
        >
          <span class="flex items-center gap-2">
            <Search class="size-3.5" />
            <span>搜索或切换工具…</span>
          </span>
          <kbd
            class="pointer-events-none rounded-[6px] border border-line bg-raised px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-muted"
          >
            {{ shortcutLabel }}
          </kbd>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="w-8 px-0 sm:hidden"
          aria-label="搜索或切换工具"
          @click="emit('openSearch')"
        >
          <Search class="size-4" />
        </Button>

        <ThemeSwitcher label="切换外观主题" :labels="themeLabels">
          <template #icon="{ theme }">
            <Sun v-if="theme === 'light'" class="size-4" aria-hidden="true" />
            <Moon v-else-if="theme === 'dark'" class="size-4" aria-hidden="true" />
            <Monitor v-else class="size-4" aria-hidden="true" />
            <span class="hidden text-[13px] sm:inline">{{ themeLabels[theme] }}</span>
          </template>
        </ThemeSwitcher>
      </div>
    </div>
  </header>
</template>
