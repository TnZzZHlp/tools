<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useId, watch } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { ListboxItem } from 'reka-ui'
import { useCommandContext, useCommandGroupContext } from './context'

defineOptions({ inheritAttrs: false })

export type CommandItemProps = {
  value: string
  /** Extra search terms matched alongside `value`. */
  keywords?: readonly string[]
  disabled?: boolean
}

const props = withDefaults(defineProps<CommandItemProps>(), {
  keywords: undefined,
  disabled: false,
})

const emit = defineEmits<{ select: [event: Event] }>()

const context = useCommandContext()
const groupContext = useCommandGroupContext()
const id = useId()

watch(
  () => [props.value, props.keywords] as const,
  ([value, keywords]) => {
    context.registerItem(id, { value, keywords })
    groupContext?.registerGroupItem(id)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  context.unregisterItem(id)
  groupContext?.unregisterGroupItem(id)
})

const isVisible = computed(
  () => context.visibleIds.value.has(id) || context.matches(props.value, props.keywords),
)

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <ListboxItem
    v-if="isVisible"
    v-bind="forwarded"
    :value="value"
    :disabled="disabled"
    :class="
      cn(
        'relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[10px] px-2.5 py-1.5',
        'text-[14px] font-medium text-ink-muted outline-none',
        'transition-[background-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
        'data-[highlighted]:bg-control data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-55',
        attrs.class as ClassValue,
      )
    "
    @select="emit('select', $event)"
  >
    <slot />
  </ListboxItem>
</template>
