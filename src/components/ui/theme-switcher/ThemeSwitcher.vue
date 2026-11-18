<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { Button } from '../button'
import { useTheme } from '../theme-provider'
import type { ThemeChoice } from '../theme-provider'

defineOptions({ inheritAttrs: false })

export type ThemeSwitcherProps = {
  /** Accessible name for the trigger. */
  label?: string
  labels?: Record<ThemeChoice, string>
}

const props = withDefaults(defineProps<ThemeSwitcherProps>(), {
  label: 'Appearance',
  labels: () => ({ system: 'System', light: 'Light', dark: 'Dark' }),
})

const { theme, setTheme } = useTheme()

const choices: readonly ThemeChoice[] = ['system', 'light', 'dark']

// The radio group wants a plain string model; the injected ref stays the single source.
const model = computed({
  get: () => theme.value,
  set: (next: string) => setTheme(next as ThemeChoice),
})
</script>

<template>
  <DropdownMenu v-bind="$attrs">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" :aria-label="props.label">
        <slot name="icon" :theme="theme">
          <span data-theme-label>{{ props.labels[theme] }}</span>
        </slot>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :min-width="160">
      <DropdownMenuRadioGroup v-model="model">
        <DropdownMenuRadioItem
          v-for="choice in choices"
          :key="choice"
          :value="choice"
          :data-testid="`theme-${choice}`"
        >
          {{ props.labels[choice] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
