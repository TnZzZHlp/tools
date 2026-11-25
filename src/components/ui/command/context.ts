import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export type CommandItemMeta = {
  value: string
  keywords?: readonly string[]
  disabled?: boolean
}

export type CommandContext = {
  search: Ref<string>
  disabled: ComputedRef<boolean>
  multiple: ComputedRef<boolean>
  isSelected: (value: string) => boolean
  select: (value: string, event: Event) => void
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

const collator = new Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' })

export function containsCommandText(text: string, query: string) {
  const target = text.normalize('NFC')
  const search = query.normalize('NFC')
  for (let index = 0; index <= target.length - search.length; index += 1) {
    if (collator.compare(target.slice(index, index + search.length), search) === 0) return true
  }
  return false
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
