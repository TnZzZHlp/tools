<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Clock, Search, X } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getCategoryLabel,
  TOOL_CATEGORIES,
  TOOLS,
  useRecentTools,
  type ToolCategoryId,
  type ToolDefinition,
} from '@/lib/tools'

const searchQuery = ref('')
const activeCategory = ref<'all' | ToolCategoryId>('all')
const { recentIds } = useRecentTools()

const recentTools = computed(() =>
  recentIds.value
    .map((id) => TOOLS.find((tool) => tool.id === id))
    .filter((tool): tool is ToolDefinition => Boolean(tool)),
)

const filteredTools = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  return TOOLS.filter((tool) => {
    if (activeCategory.value !== 'all' && tool.category !== activeCategory.value) {
      return false
    }
    if (!q) return true

    const categoryLabel = getCategoryLabel(tool.category).toLowerCase()
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.shortName.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      categoryLabel.includes(q) ||
      tool.keywords.some((kw) => kw.toLowerCase().includes(q))
    )
  })
})

const categoryCounts = computed(() => {
  const counts: Record<string, number> = { all: TOOLS.length }
  for (const cat of TOOL_CATEGORIES) {
    counts[cat.id] = TOOLS.filter((t) => t.category === cat.id).length
  }
  return counts
})

function resetFilters() {
  searchQuery.value = ''
  activeCategory.value = 'all'
}
</script>

<template>
  <div class="space-y-6 pb-8 sm:space-y-8">
    <!-- Hero & Filter Controls -->
    <section class="space-y-4">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div class="space-y-1.5">
          <h1 class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">实用工具集</h1>
          <p class="text-[14px] leading-relaxed text-ink-muted sm:text-[15px]">
            轻量、即开即用的在线工具箱，涵盖网络测速、文档合并、图文识别、条码排版与开发辅助。
          </p>
        </div>

        <div class="relative w-full sm:w-72 lg:w-80">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            v-model="searchQuery"
            type="search"
            placeholder="筛选工具（如 测速、PDF、二维码）…"
            aria-label="筛选工具"
            class="h-10 bg-raised pr-8 pl-9 text-[14px]"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-[6px] p-0.5 text-ink-muted hover:text-ink"
            aria-label="清除搜索"
            @click="searchQuery = ''"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="工具分类筛选">
        <Button
          type="button"
          size="sm"
          :variant="activeCategory === 'all' ? 'primary' : 'secondary'"
          class="rounded-full px-3.5"
          :class="
            activeCategory !== 'all' && 'border border-line bg-raised text-ink-muted hover:text-ink'
          "
          @click="activeCategory = 'all'"
        >
          全部
          <span class="font-condensed tabular-nums opacity-75">{{ categoryCounts.all }}</span>
        </Button>

        <Button
          v-for="cat in TOOL_CATEGORIES"
          :key="cat.id"
          type="button"
          size="sm"
          :variant="activeCategory === cat.id ? 'primary' : 'secondary'"
          class="rounded-full px-3.5"
          :class="
            activeCategory !== cat.id &&
            'border border-line bg-raised text-ink-muted hover:text-ink'
          "
          @click="activeCategory = cat.id"
        >
          {{ cat.label }}
          <span class="font-condensed tabular-nums opacity-75">{{ categoryCounts[cat.id] }}</span>
        </Button>
      </div>
    </section>

    <!-- Recently Used Strip -->
    <section
      v-if="recentTools.length && !searchQuery && activeCategory === 'all'"
      aria-label="最近使用的工具"
      class="space-y-2.5"
    >
      <div class="flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
        <Clock class="size-3.5" />
        <span>最近使用</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          v-for="tool in recentTools"
          :key="`recent-${tool.id}`"
          :to="tool.to"
          class="group inline-flex items-center gap-2 rounded-control border border-line bg-raised px-3 py-1.5 text-[13px] font-medium text-ink outline-none transition-[background-color,border-color,color] duration-[var(--p0seid0n-duration-fast)] hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
        >
          <component
            :is="tool.icon"
            class="size-3.5 text-ink-muted transition-colors group-hover:text-ink"
          />
          <span>{{ tool.shortName }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- Tools Grid -->
    <section aria-label="工具列表">
      <ul v-if="filteredTools.length" class="grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <li v-for="tool in filteredTools" :key="tool.id">
          <RouterLink
            :to="tool.to"
            class="group flex h-full flex-col justify-between rounded-panel border border-line bg-raised p-5 outline-none transition-[border-color,transform,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-out-expo hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--color-ink)_35%,var(--color-line))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid"
          >
            <div>
              <div class="mb-3.5 flex items-center justify-between gap-3">
                <div
                  class="flex size-10 items-center justify-center rounded-control border border-line bg-control text-ink transition-colors duration-[var(--p0seid0n-duration-normal)] group-hover:border-ink group-hover:bg-ink group-hover:text-surface"
                >
                  <component :is="tool.icon" class="size-5" />
                </div>

                <div class="flex items-center gap-1.5">
                  <Badge variant="neutral">
                    {{ getCategoryLabel(tool.category) }}
                  </Badge>
                  <ArrowUpRight
                    class="size-4 text-ink-faint transition-[transform,color] duration-[var(--p0seid0n-duration-normal)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <h2 class="text-[16px] font-semibold tracking-tight text-ink sm:text-[17px]">
                {{ tool.name }}
              </h2>
              <p class="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                {{ tool.description }}
              </p>
            </div>
          </RouterLink>
        </li>
      </ul>

      <div
        v-else
        class="flex flex-col items-center justify-center rounded-panel border border-dashed border-line bg-raised px-6 py-14 text-center"
      >
        <Search class="mb-3 size-8 text-ink-faint" aria-hidden="true" />
        <p class="text-[15px] font-medium text-ink">没有找到匹配的工具</p>
        <p class="mt-1 text-[13px] text-ink-muted">尝试更换关键词，或查看全部分类下的工具。</p>
        <Button variant="secondary" size="sm" class="mt-4" @click="resetFilters">
          清除筛选条件
        </Button>
      </div>
    </section>
  </div>
</template>
