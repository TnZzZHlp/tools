<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { CommandInput as SdkCommandInput } from '@ui-sdk/vue/command'
import { useCommandContext } from './context'

defineOptions({ inheritAttrs: false })

export type CommandInputProps = {
  autoFocus?: boolean
  disabled?: boolean
}

withDefaults(defineProps<CommandInputProps>(), {
  autoFocus: false,
  disabled: false,
})

const { disabled: commandDisabled } = useCommandContext()

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <div class="flex items-center gap-2 border-b border-line px-3">
    <slot name="icon">
      <svg
        class="size-4 shrink-0 text-ink-muted"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </svg>
    </slot>
    <SdkCommandInput
      v-bind="forwarded"
      :autofocus="autoFocus"
      :disabled="disabled || commandDisabled"
      :class="
        cn(
          'flex h-11 w-full bg-transparent py-2.5 text-[14px] text-ink placeholder:text-ink-muted',
          'outline-none disabled:cursor-default disabled:opacity-55',
          attrs.class as ClassValue,
        )
      "
    />
  </div>
</template>
