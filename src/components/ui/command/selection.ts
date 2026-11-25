import { computed, shallowRef, type Ref } from 'vue'

type Value = string | string[]

export function useCommandSelection(
  model: Ref<Value | undefined>,
  multiple: Readonly<Ref<boolean>>,
  disabled: Readonly<Ref<boolean>>,
  visibleChoices: Readonly<Ref<string[]>>,
  initial: Value | undefined,
) {
  const fallback = shallowRef(initial)
  const selected = computed(() => model.value ?? fallback.value)
  let anchor: string | undefined

  function update(value: Value) {
    fallback.value = value
    model.value = value
  }

  function select(value: string, event: Event) {
    if (disabled.value || event.defaultPrevented) return
    anchor = value
    update(multiple.value ? [value] : value)
  }

  function extend(value: string) {
    if (disabled.value || !multiple.value || anchor === undefined) return
    const choices = visibleChoices.value
    const start = choices.indexOf(anchor)
    const end = choices.indexOf(value)
    if (start >= 0 && end >= 0) {
      update(choices.slice(Math.min(start, end), Math.max(start, end) + 1))
    }
  }

  function isSelected(value: string) {
    return Array.isArray(selected.value) ? selected.value.includes(value) : selected.value === value
  }

  return { select, extend, isSelected }
}
