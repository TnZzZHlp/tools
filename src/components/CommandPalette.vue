<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Clock, Home, Moon, Search, Sun, X } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTheme } from '@/composables/useTheme'
import {
  getCategoryLabel,
  TOOL_CATEGORIES,
  TOOLS,
  useRecentTools,
  type ToolDefinition,
} from '@/lib/tools'
import { cn } from '@/lib/utils'

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const { recentIds } = useRecentTools()

const query = ref('')
const activeIndex = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)
const listContainerRef = ref<HTMLElement | null>(null)

interface PaletteEntry {
  key: string
  group: string
  title: string
  subtitle?: string
  badge?: string
  icon: Component
  active?: boolean
  run: () => void
}

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

function matchesTool(tool: ToolDefinition, q: string): boolean {
  if (!q) return true
  const categoryLabel = getCategoryLabel(tool.category).toLowerCase()
  return (
    tool.name.toLowerCase().includes(q) ||
    tool.shortName.toLowerCase().includes(q) ||
    tool.description.toLowerCase().includes(q) ||
    categoryLabel.includes(q) ||
    tool.keywords.some((kw) => kw.toLowerCase().includes(q))
  )
}

function go(to: string) {
  open.value = false
  if (route.path !== to) {
    void router.push(to)
  }
}

const groupedEntries = computed(() => {
  const q = normalizedQuery.value
  const groups: Array<{ label: string; items: PaletteEntry[] }> = []

  if (!q && recentIds.value.length) {
    const recentItems = recentIds.value
      .map((id) => TOOLS.find((t) => t.id === id))
      .filter((t): t is ToolDefinition => Boolean(t))
      .map(
        (tool): PaletteEntry => ({
          key: `recent-${tool.id}`,
          group: '最近使用',
          title: tool.name,
          subtitle: tool.description,
          badge: getCategoryLabel(tool.category),
          icon: Clock,
          active: route.path === tool.to,
          run: () => go(tool.to),
        }),
      )

    if (recentItems.length) {
      groups.push({ label: '最近使用', items: recentItems })
    }
  }

  if (q) {
    const matched = TOOLS.filter((tool) => matchesTool(tool, q)).map(
      (tool): PaletteEntry => ({
        key: `tool-${tool.id}`,
        group: '匹配工具',
        title: tool.name,
        subtitle: tool.description,
        badge: getCategoryLabel(tool.category),
        icon: tool.icon,
        active: route.path === tool.to,
        run: () => go(tool.to),
      }),
    )
    if (matched.length) {
      groups.push({ label: '匹配工具', items: matched })
    }
  } else {
    for (const category of TOOL_CATEGORIES) {
      const categoryTools = TOOLS.filter((tool) => tool.category === category.id).map(
        (tool): PaletteEntry => ({
          key: `tool-${tool.id}`,
          group: category.label,
          title: tool.name,
          subtitle: tool.description,
          icon: tool.icon,
          active: route.path === tool.to,
          run: () => go(tool.to),
        }),
      )
      if (categoryTools.length) {
        groups.push({ label: category.label, items: categoryTools })
      }
    }
  }

  const quickActions: PaletteEntry[] = []
  if (route.path !== '/' && (!q || '返回首页 home 主页'.includes(q))) {
    quickActions.push({
      key: 'action-home',
      group: '快捷操作',
      title: '返回工具首页',
      subtitle: '浏览全部实用工具',
      icon: Home,
      run: () => go('/'),
    })
  }
  if (!q || '切换主题 深色模式 浅色模式 dark light theme'.includes(q)) {
    quickActions.push({
      key: 'action-theme',
      group: '快捷操作',
      title: isDark.value ? '切换到浅色模式' : '切换到深色模式',
      subtitle: '自动记住当前外观偏好',
      icon: isDark.value ? Sun : Moon,
      run: () => {
        toggleTheme()
        open.value = false
      },
    })
  }

  if (quickActions.length) {
    groups.push({ label: '快捷操作', items: quickActions })
  }

  return groups
})

const flatEntries = computed(() => groupedEntries.value.flatMap((group) => group.items))

const entryIndexMap = computed(() => {
  const map = new Map<string, number>()
  flatEntries.value.forEach((entry, idx) => map.set(entry.key, idx))
  return map
})

watch(normalizedQuery, () => {
  activeIndex.value = 0
})

watch(open, async (isOpen) => {
  if (isOpen) {
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    searchInputRef.value?.focus()
  }
})

function scrollActiveIntoView() {
  void nextTick(() => {
    const activeEl = listContainerRef.value?.querySelector<HTMLElement>(
      '[data-palette-active="true"]',
    )
    activeEl?.scrollIntoView({ block: 'nearest' })
  })
}

function handleInputKeydown(event: KeyboardEvent) {
  const total = flatEntries.value.length
  if (!total) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    flatEntries.value[activeIndex.value]?.run()
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="gap-0 overflow-hidden p-0 shadow-xl sm:max-w-xl"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>搜索与快速切换工具</DialogTitle>
        <DialogDescription>输入名称或关键词快速跳转到任意工具或执行操作</DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-2.5 border-b px-3.5 py-2.5">
        <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref="searchInputRef"
          v-model="query"
          type="text"
          class="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder="搜索工具名称、功能或关键词（如 PDF、UUID、二维码、Unicode）…"
          aria-label="搜索工具"
          @keydown="handleInputKeydown"
        />
        <button
          v-if="query"
          type="button"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="清空搜索词"
          @click="query = ''"
        >
          <X class="size-3.5" />
        </button>
        <kbd
          class="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block"
        >
          ESC
        </kbd>
      </div>

      <div ref="listContainerRef" class="max-h-[min(65dvh,26rem)] overflow-y-auto p-2">
        <template v-if="groupedEntries.length">
          <div v-for="group in groupedEntries" :key="group.label" class="mb-2 last:mb-0">
            <div class="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              {{ group.label }}
            </div>
            <div class="space-y-0.5">
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                :data-palette-active="entryIndexMap.get(item.key) === activeIndex"
                :class="
                  cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    entryIndexMap.get(item.key) === activeIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-muted/60',
                  )
                "
                @mouseenter="activeIndex = entryIndexMap.get(item.key) ?? 0"
                @click="item.run"
              >
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-2xs"
                >
                  <component :is="item.icon" class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ item.title }}</span>
                    <Badge v-if="item.active" variant="secondary" class="px-1.5 py-0 text-[10px]">
                      当前
                    </Badge>
                    <Badge
                      v-else-if="item.badge"
                      variant="outline"
                      class="px-1.5 py-0 text-[10px] font-normal"
                    >
                      {{ item.badge }}
                    </Badge>
                  </div>
                  <p v-if="item.subtitle" class="truncate text-xs text-muted-foreground">
                    {{ item.subtitle }}
                  </p>
                </div>
                <ArrowRight
                  class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                  :class="
                    entryIndexMap.get(item.key) === activeIndex
                      ? 'translate-x-0.5 opacity-100'
                      : 'opacity-0'
                  "
                />
              </button>
            </div>
          </div>
        </template>

        <div v-else class="py-10 text-center">
          <p class="text-sm font-medium text-foreground">未找到匹配的工具</p>
          <p class="mt-1 text-xs text-muted-foreground">
            换个关键词试试，例如 PDF、条码、OCR、随机
          </p>
        </div>
      </div>

      <div
        class="flex items-center justify-between border-t bg-muted/35 px-3.5 py-2 text-[11px] text-muted-foreground"
      >
        <div class="flex items-center gap-3">
          <span
            ><kbd class="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            选择</span
          >
          <span
            ><kbd class="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            打开</span
          >
        </div>
        <span>共 {{ TOOLS.length }} 款工具</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
