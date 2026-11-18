<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Blocks, ChevronLeft, ChevronRight, Moon, Search, Sun } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/composables/useTheme'
import { resolveBackTarget, resolveRouteBreadcrumbs } from '@/lib/tools'

const emit = defineEmits<{
  openSearch: []
}>()

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useTheme()

const isHome = computed(() => route.path === '/')
const breadcrumbs = computed(() => resolveRouteBreadcrumbs(route.path))
const currentCrumbLabel = computed(
  () => breadcrumbs.value[breadcrumbs.value.length - 1]?.label ?? 'Tools',
)
const backTarget = computed(() => resolveBackTarget(route.path))

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'
</script>

<template>
  <header
    class="sticky top-0 z-40 shrink-0 border-b border-border/75 bg-background/85 backdrop-blur-md"
  >
    <div
      class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
    >
      <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          v-if="!isHome"
          variant="ghost"
          size="icon"
          class="size-8 shrink-0 sm:hidden"
          aria-label="返回上一级"
          @click="router.push(backTarget)"
        >
          <ChevronLeft class="size-4.5" />
        </Button>

        <RouterLink
          to="/"
          class="group flex shrink-0 items-center gap-2 rounded-md py-1 pr-1.5 text-foreground transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span
            class="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs transition-transform group-hover:scale-[1.03]"
          >
            <Blocks class="size-4" />
          </span>
          <span class="text-base font-semibold tracking-tight">Tools</span>
        </RouterLink>

        <span v-if="!isHome" class="truncate text-sm font-medium text-muted-foreground sm:hidden">
          / {{ currentCrumbLabel }}
        </span>

        <nav
          v-if="!isHome && breadcrumbs.length"
          aria-label="面包屑导航"
          class="hidden min-w-0 items-center gap-1 text-sm sm:flex"
        >
          <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
            <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            <RouterLink
              v-if="crumb.to"
              :to="crumb.to"
              class="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {{ crumb.label }}
            </RouterLink>
            <span
              v-else
              class="truncate px-1.5 py-0.5"
              :class="
                index === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              "
            >
              {{ crumb.label }}
            </span>
          </template>
        </nav>
      </div>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="hidden h-8 w-52 justify-between gap-2 bg-muted/40 px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted/80 hover:text-foreground sm:inline-flex lg:w-60"
          @click="emit('openSearch')"
        >
          <span class="flex items-center gap-2">
            <Search class="size-3.5" />
            <span>搜索或切换工具…</span>
          </span>
          <kbd
            class="pointer-events-none rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
          >
            {{ shortcutLabel }}
          </kbd>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-8 sm:hidden"
          aria-label="搜索或切换工具"
          @click="emit('openSearch')"
        >
          <Search class="size-4" />
        </Button>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-8"
              :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
              @click="toggleTheme"
            >
              <Sun v-if="isDark" class="size-4" />
              <Moon v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ isDark ? '切换到浅色模式' : '切换到深色模式' }}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>
</template>
