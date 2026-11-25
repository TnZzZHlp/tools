const accordionSelector = '[data-slot="accordion"]'
const triggerSelector = 'button[data-slot="accordion-trigger"]:not(:disabled)'

export function navigateAccordion(event: KeyboardEvent, orientation: 'horizontal' | 'vertical') {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return

  const root = event.currentTarget
  if (!(root instanceof HTMLElement) || !(event.target instanceof HTMLElement)) return
  const trigger = event.target.closest(triggerSelector)
  if (!trigger || trigger.closest(accordionSelector) !== root) return

  const horizontal = orientation === 'horizontal'
  const rtl = horizontal && getComputedStyle(root).direction === 'rtl'
  const next = horizontal ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
  const previous = horizontal ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'
  if (![next, previous, 'Home', 'End'].includes(event.key)) return

  const triggers = [...root.querySelectorAll<HTMLButtonElement>(triggerSelector)].filter(
    (element) => element.closest(accordionSelector) === root,
  )
  const index = triggers.indexOf(trigger as HTMLButtonElement)
  if (index < 0) return

  event.preventDefault()
  if (event.key === 'Home') triggers[0]?.focus()
  else if (event.key === 'End') triggers[triggers.length - 1]?.focus()
  else {
    const step = event.key === next ? 1 : -1
    triggers[(index + step + triggers.length) % triggers.length]?.focus()
  }
}
