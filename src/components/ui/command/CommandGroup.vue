<script setup lang="ts">
import { computed, reactive, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ListboxGroup, ListboxGroupLabel } from 'reka-ui'
import { provideCommandGroupContext, useCommandContext } from './context'

defineOptions({ inheritAttrs: false })

export type CommandGroupProps = {
  heading?: string
}

withDefaults(defineProps<CommandGroupProps>(), {
  heading: undefined,
})

const context = useCommandContext()
const groupIds = reactive(new Set<string>())

provideCommandGroupContext({
  registerGroupItem: (id) => {
    groupIds.add(id)
  },
  unregisterGroupItem: (id) => {
    groupIds.delete(id)
  },
})

const isVisible = computed(() => {
  if (context.filterDisabled.value || context.search.value.trim() === '') return true
  if (groupIds.size === 0) return false
  for (const id of groupIds) {
    if (context.visibleIds.value.has(id)) return true
  }
  return false
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ListboxGroup
    v-show="isVisible"
    v-bind="forwarded"
    :class="cn('overflow-hidden text-ink [&+&]:mt-1', attrs.class as ClassValue)"
  >
    <ListboxGroupLabel
      v-if="heading || $slots.heading"
      class="px-2.5 py-1.5 text-[12px] font-medium text-ink-faint"
    >
      <slot name="heading">{{ heading }}</slot>
    </ListboxGroupLabel>
    <slot />
  </ListboxGroup>
</template>
