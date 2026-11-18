<script setup lang="ts">
import { computed, reactive, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ListboxRoot, useFilter } from 'reka-ui'
import { matchesCommandItem, provideCommandContext, type CommandItemMeta } from './context'

defineOptions({ name: 'UiCommand', inheritAttrs: false })

export type CommandProps = {
  filterDisabled?: boolean
  loop?: boolean
  multiple?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<CommandProps>(), {
  filterDisabled: false,
  loop: true,
  multiple: false,
  disabled: false,
})

const model = defineModel<string | string[]>()
const searchTerm = defineModel<string>('searchTerm', { default: '' })

const { contains } = useFilter({ sensitivity: 'base' })
const items = reactive(new Map<string, CommandItemMeta>())

const filterDisabled = computed(() => props.filterDisabled)

const visibleIds = computed(() => {
  const set = new Set<string>()
  const query = searchTerm.value.trim()
  for (const [id, meta] of items) {
    if (
      props.filterDisabled ||
      query === '' ||
      matchesCommandItem(meta.value, meta.keywords, query, contains)
    ) {
      set.add(id)
    }
  }
  return set
})

provideCommandContext({
  search: searchTerm,
  filterDisabled,
  visibleIds,
  registerItem: (id, meta) => {
    items.set(id, meta)
  },
  unregisterItem: (id) => {
    items.delete(id)
  },
  matches: (value, keywords) => {
    if (props.filterDisabled) return true
    return matchesCommandItem(value, keywords, searchTerm.value, contains)
  },
})

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ListboxRoot
    v-model="model"
    v-bind="forwarded"
    :loop="loop"
    :multiple="multiple"
    :disabled="disabled"
    highlight-on-hover
    selection-behavior="replace"
    :class="
      cn(
        'flex h-full w-full flex-col overflow-hidden rounded-panel border border-line bg-raised text-ink',
        attrs.class as ClassValue,
      )
    "
  >
    <slot />
  </ListboxRoot>
</template>
