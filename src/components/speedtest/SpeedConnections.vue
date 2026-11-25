<script setup lang="ts">
import { computed } from 'vue'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { ThreadMode } from '@/lib/speedtest'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const mode = defineModel<ThreadMode>({ default: 'multi' })

const isSingle = computed({
  get: () => mode.value === 'single',
  set: (checked: boolean) => {
    mode.value = checked ? 'single' : 'multi'
  },
})

function setMode(next: ThreadMode) {
  if (props.disabled) return
  mode.value = next
}
</script>

<template>
  <div
    role="group"
    aria-label="连接模式"
    :class="
      cn(
        'mt-1.5 flex items-center gap-2 transition-opacity duration-[var(--p0seid0n-duration-normal)] lg:mt-2 lg:gap-3',
        disabled && 'opacity-55',
      )
    "
  >
    <button
      type="button"
      tabindex="-1"
      aria-hidden="true"
      :disabled="disabled"
      :class="
        cn(
          'px-0.5 py-1 text-[14px] font-medium transition-colors duration-[var(--p0seid0n-duration-fast)] lg:text-[16px]',
          disabled ? 'cursor-default' : 'cursor-pointer',
          mode === 'multi' ? 'text-ink' : 'text-ink-muted hover:text-ink',
        )
      "
      @click="setMode('multi')"
    >
      多线程
    </button>

    <Switch
      v-model="isSingle"
      :disabled="disabled"
      aria-label="切换单线程测速"
      class="data-checked:border-line data-checked:bg-control [&>*]:bg-ink [&>*]:text-surface [&>*]:data-checked:text-surface"
    >
      <template #thumb>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="size-3.5"
        >
          <path
            v-if="mode === 'multi'"
            d="M3 4h8m-2.5-2.5L11 4l-2.5 2.5M3 12h8m-2.5-2.5L11 12l-2.5 2.5"
          />
          <path d="M3 8h8M8.5 5.5 11 8l-2.5 2.5" />
        </svg>
      </template>
    </Switch>

    <button
      type="button"
      tabindex="-1"
      aria-hidden="true"
      :disabled="disabled"
      :class="
        cn(
          'px-0.5 py-1 text-[14px] font-medium transition-colors duration-[var(--p0seid0n-duration-fast)] lg:text-[16px]',
          disabled ? 'cursor-default' : 'cursor-pointer',
          mode === 'single' ? 'text-ink' : 'text-ink-muted hover:text-ink',
        )
      "
      @click="setMode('single')"
    >
      单线程
    </button>
  </div>
</template>
