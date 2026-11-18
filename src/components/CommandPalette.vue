<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Clock, Home, Moon, Sun } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useTheme } from '@/composables/useTheme'
import {
  getCategoryLabel,
  TOOL_CATEGORIES,
  TOOLS,
  useRecentTools,
  type ToolDefinition,
} from '@/lib/tools'

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const { recentIds } = useRecentTools()

const recentTools = computed(() =>
  recentIds.value
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is ToolDefinition => Boolean(t)),
)

const categoryGroups = computed(() =>
  TOOL_CATEGORIES.map((category) => ({
    ...category,
    tools: TOOLS.filter((tool) => tool.category === category.id),
  })).filter((group) => group.tools.length > 0),
)

function go(to: string) {
  open.value = false
  if (route.path !== to) {
    void router.push(to)
  }
}

function toggleThemeAndClose() {
  toggleTheme()
  open.value = false
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
  <CommandDialog
    v-model:open="open"
    title="搜索与快速切换工具"
    description="输入名称或关键词快速跳转到任意工具或执行操作"
    class="w-[min(36rem,calc(100vw-2rem))]"
  >
    <CommandInput
      auto-focus
      placeholder="搜索工具名称、功能或关键词（如测速、PDF、UUID、二维码）…"
      aria-label="搜索工具"
    />

    <CommandList class="max-h-[min(65dvh,26rem)] p-2">
      <CommandEmpty class="py-10">
        <p class="text-[14px] font-medium text-ink">未找到匹配的工具</p>
        <p class="mt-1 text-[12px] text-ink-muted">
          换个关键词试试，例如 测速、PDF、条码、OCR、随机
        </p>
      </CommandEmpty>

      <CommandGroup v-if="recentTools.length" heading="最近使用">
        <CommandItem
          v-for="tool in recentTools"
          :key="`recent-${tool.id}`"
          :value="`__recent__:${tool.id}`"
          class="group gap-3 py-2"
          @select="go(tool.to)"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-raised text-ink"
          >
            <Clock class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[14px] font-medium text-ink">{{ tool.name }}</span>
              <Badge v-if="route.path === tool.to" variant="accent" class="px-1.5 py-0 text-[10px]">
                当前
              </Badge>
              <Badge v-else variant="outline" class="px-1.5 py-0 text-[10px]">
                {{ getCategoryLabel(tool.category) }}
              </Badge>
            </div>
            <p class="truncate text-[12px] text-ink-muted">{{ tool.description }}</p>
          </div>
          <ArrowRight
            class="size-3.5 shrink-0 text-ink-muted opacity-0 transition-[opacity,transform] duration-[var(--p0seid0n-duration-fast)] group-data-[highlighted]:translate-x-0.5 group-data-[highlighted]:opacity-100"
          />
        </CommandItem>
      </CommandGroup>

      <CommandSeparator v-if="recentTools.length" />

      <CommandGroup v-for="group in categoryGroups" :key="group.id" :heading="group.label">
        <CommandItem
          v-for="tool in group.tools"
          :key="tool.id"
          :value="`tool:${tool.id}`"
          :keywords="[tool.name, tool.shortName, tool.description, group.label, ...tool.keywords]"
          class="group gap-3 py-2"
          @select="go(tool.to)"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-raised text-ink"
          >
            <component :is="tool.icon" class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[14px] font-medium text-ink">{{ tool.name }}</span>
              <Badge v-if="route.path === tool.to" variant="accent" class="px-1.5 py-0 text-[10px]">
                当前
              </Badge>
            </div>
            <p class="truncate text-[12px] text-ink-muted">{{ tool.description }}</p>
          </div>
          <ArrowRight
            class="size-3.5 shrink-0 text-ink-muted opacity-0 transition-[opacity,transform] duration-[var(--p0seid0n-duration-fast)] group-data-[highlighted]:translate-x-0.5 group-data-[highlighted]:opacity-100"
          />
        </CommandItem>
      </CommandGroup>

      <CommandSeparator />

      <CommandGroup heading="快捷操作">
        <CommandItem
          v-if="route.path !== '/'"
          value="action:home"
          :keywords="['返回工具首页', '返回首页', 'home', '主页']"
          class="group gap-3 py-2"
          @select="go('/')"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-raised text-ink"
          >
            <Home class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[14px] font-medium text-ink">返回工具首页</span>
            </div>
            <p class="truncate text-[12px] text-ink-muted">浏览全部实用工具</p>
          </div>
          <ArrowRight
            class="size-3.5 shrink-0 text-ink-muted opacity-0 transition-[opacity,transform] duration-[var(--p0seid0n-duration-fast)] group-data-[highlighted]:translate-x-0.5 group-data-[highlighted]:opacity-100"
          />
        </CommandItem>

        <CommandItem
          value="action:theme"
          :keywords="['切换主题', '切换到浅色模式', '切换到深色模式', 'dark', 'light', 'theme']"
          class="group gap-3 py-2"
          @select="toggleThemeAndClose"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-raised text-ink"
          >
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[14px] font-medium text-ink">
                {{ isDark ? '切换到浅色模式' : '切换到深色模式' }}
              </span>
            </div>
            <p class="truncate text-[12px] text-ink-muted">自动记住当前外观偏好</p>
          </div>
          <ArrowRight
            class="size-3.5 shrink-0 text-ink-muted opacity-0 transition-[opacity,transform] duration-[var(--p0seid0n-duration-fast)] group-data-[highlighted]:translate-x-0.5 group-data-[highlighted]:opacity-100"
          />
        </CommandItem>
      </CommandGroup>
    </CommandList>

    <div
      class="flex items-center justify-between border-t border-line bg-surface px-3.5 py-2 text-[11px] text-ink-muted"
    >
      <div class="flex items-center gap-3">
        <span>
          <kbd class="rounded-[5px] border border-line bg-raised px-1 py-0.5 font-sans text-[10px]"
            >↑↓</kbd
          >
          选择
        </span>
        <span>
          <kbd class="rounded-[5px] border border-line bg-raised px-1 py-0.5 font-sans text-[10px]"
            >↵</kbd
          >
          打开
        </span>
      </div>
      <span class="tabular-nums">共 {{ TOOLS.length }} 款工具</span>
    </div>
  </CommandDialog>
</template>
