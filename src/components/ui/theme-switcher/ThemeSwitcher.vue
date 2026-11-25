<script setup lang="ts">
import { Menu, MenuItemIndicator, MenuRadioGroup, MenuRadioItem } from '@ui-sdk/vue/menu'
import { DropdownMenuContent, DropdownMenuTrigger } from '../dropdown-menu'
import { menuItem } from '../dropdown-menu/styles'
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

function onThemeChange(next: string | null) {
  if (next === 'system' || next === 'light' || next === 'dark') setTheme(next)
}
</script>

<template>
  <Menu :modal="false" v-bind="$attrs">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" :aria-label="props.label">
        <slot name="icon" :theme="theme">
          <span data-theme-label>{{ props.labels[theme] }}</span>
        </slot>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :min-width="160">
      <MenuRadioGroup :value="theme" :aria-label="props.label" @update:value="onThemeChange">
        <MenuRadioItem
          v-for="choice in choices"
          :key="choice"
          :value="choice"
          :close-on-select="true"
          :data-testid="`theme-${choice}`"
          :class="menuItem"
        >
          <span class="flex size-3.5 shrink-0 items-center justify-center">
            <MenuItemIndicator class="before:hidden">
              <span class="block size-1.5 rounded-full bg-ink" />
            </MenuItemIndicator>
          </span>
          {{ props.labels[choice] }}
        </MenuRadioItem>
      </MenuRadioGroup>
    </DropdownMenuContent>
  </Menu>
</template>
