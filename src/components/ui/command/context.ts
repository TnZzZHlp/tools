import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export type CommandItemMeta = {
  value: string
  keywords?: readonly string[]
}

export type CommandContext = {
  search: Ref<string>
  filterDisabled: ComputedRef<boolean>
  visibleIds: ComputedRef<Set<string>>
  registerItem: (id: string, meta: CommandItemMeta) => void
  unregisterItem: (id: string) => void
  matches: (value: string, keywords?: readonly string[]) => boolean
}

export type CommandGroupContext = {
  registerGroupItem: (id: string) => void
  unregisterGroupItem: (id: string) => void
}

const COMMAND_CONTEXT_KEY: InjectionKey<CommandContext> = Symbol('p0seid0n-command')
const COMMAND_GROUP_CONTEXT_KEY: InjectionKey<CommandGroupContext> =
  Symbol('p0seid0n-command-group')

/**
 * Pure matching predicate shared by Command filtering and unit tests.
 */
export function matchesCommandItem(
  value: string,
  keywords: readonly string[] | undefined,
  query: string,
  contains: (text: string, sub: string) => boolean,
): boolean {
  const trimmed = query.trim()
  if (trimmed === '') return true
  if (contains(value, trimmed)) return true
  if (!keywords || keywords.length === 0) return false
  return keywords.some((keyword) => contains(keyword, trimmed))
}

export function provideCommandContext(context: CommandContext): void {
  provide(COMMAND_CONTEXT_KEY, context)
}

export function useCommandContext(): CommandContext {
  const context = inject(COMMAND_CONTEXT_KEY)
  if (!context) {
    throw new Error('Command components must be used inside a <Command> root.')
  }
  return context
}

export function provideCommandGroupContext(context: CommandGroupContext): void {
  provide(COMMAND_GROUP_CONTEXT_KEY, context)
}

export function useCommandGroupContext(): CommandGroupContext | null {
  return inject(COMMAND_GROUP_CONTEXT_KEY, null)
}
