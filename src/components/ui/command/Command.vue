<script setup lang="ts">
import { computed, reactive, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { Command as SdkCommand, type CommandValueChangeDetails } from '@ui-sdk/vue/command'
import {
  containsCommandText,
  matchesCommandItem,
  provideCommandContext,
  type CommandItemMeta,
} from './context'
import { useCommandSelection } from './selection'

defineOptions({ name: 'UiCommand', inheritAttrs: false })

export type CommandProps = {
  filterDisabled?: boolean
  loop?: boolean
  multiple?: boolean
  disabled?: boolean
  defaultValue?: string | string[]
}

const props = withDefaults(defineProps<CommandProps>(), {
  filterDisabled: false,
  loop: true,
  multiple: false,
  disabled: false,
  defaultValue: undefined,
})

const model = defineModel<string | string[]>()
const searchTerm = defineModel<string>('searchTerm', { default: '' })

const items = reactive(new Map<string, CommandItemMeta>())

const filterDisabled = computed(() => props.filterDisabled)
const disabled = computed(() => props.disabled)
const multiple = computed(() => props.multiple)

const visibleIds = computed(() => {
  const set = new Set<string>()
  const query = searchTerm.value.trim()
  for (const [id, meta] of items) {
    if (
      props.filterDisabled ||
      query === '' ||
      matchesCommandItem(meta.value, meta.keywords, query, containsCommandText)
    ) {
      set.add(id)
    }
  }
  return set
})

const visibleChoices = computed(() =>
  [...visibleIds.value].flatMap((id) => {
    const item = items.get(id)
    return item && !item.disabled ? [item.value] : []
  }),
)
const selection = useCommandSelection(model, multiple, disabled, visibleChoices, props.defaultValue)

function onHighlight(value: string | null, details: CommandValueChangeDetails) {
  if (value !== null && details.reason === 'list-navigation' && details.event?.shiftKey) {
    selection.extend(value)
  }
}

provideCommandContext({
  search: searchTerm,
  disabled,
  multiple,
  isSelected: selection.isSelected,
  select: selection.select,
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
    return matchesCommandItem(value, keywords, searchTerm.value, containsCommandText)
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
  <SdkCommand
    v-model:query="searchTerm"
    v-bind="forwarded"
    :loop="loop"
    :filter="() => true"
    :class="
      cn(
        'flex h-full w-full flex-col overflow-hidden rounded-panel border border-line bg-raised text-ink',
        attrs.class as ClassValue,
      )
    "
    @value-change="onHighlight"
  >
    <slot />
  </SdkCommand>
</template>
