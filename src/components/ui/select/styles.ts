export const selectSurface = [
  'z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-panel border border-line bg-raised text-ink shadow-popup outline-none',
  'origin-[var(--reka-select-content-transform-origin)]',
  'data-[side=bottom]:[--p0seid0n-pop-y:-4px]',
  'data-[side=top]:[--p0seid0n-pop-y:4px]',
  'data-[side=left]:[--p0seid0n-pop-x:4px] data-[side=left]:[--p0seid0n-pop-y:0px]',
  'data-[side=right]:[--p0seid0n-pop-x:-4px] data-[side=right]:[--p0seid0n-pop-y:0px]',
  'motion-safe:animate-pop-in data-[state=closed]:motion-safe:animate-pop-out',
].join(' ')

export const selectItem = [
  'relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-[10px] px-3',
  'text-[14px] font-medium text-ink-muted outline-none',
  'transition-[background-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
  'hover:bg-control hover:text-ink',
  'focus:bg-control focus:text-ink',
  'data-[highlighted]:bg-control data-[highlighted]:text-ink',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-55',
].join(' ')

export const selectLabel = 'px-3 py-1.5 text-[12px] font-medium text-ink-faint'

export const selectSeparator = 'my-1 h-px bg-line'
