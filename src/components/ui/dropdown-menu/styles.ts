/**
 * Shared surface for every floating layer, taken from the reference menu styles:
 * 16px radius, 1px line border, popup shadow and a 6px inset so items keep their
 * own 10px radius from touching the edge. Portalled layers sit at z-50 so menus
 * opened from inside a dialog stack above that dialog.
 */
export const popupSurface = [
  'z-50 overflow-hidden rounded-panel border border-line bg-raised p-1.5 shadow-popup outline-none',
  'origin-[var(--reka-dropdown-menu-content-transform-origin)]',
  'data-[side=bottom]:[--p0seid0n-pop-y:-4px]',
  'data-[side=top]:[--p0seid0n-pop-y:4px]',
  'data-[side=left]:[--p0seid0n-pop-x:4px] data-[side=left]:[--p0seid0n-pop-y:0px]',
  'data-[side=right]:[--p0seid0n-pop-x:-4px] data-[side=right]:[--p0seid0n-pop-y:0px]',
  'motion-safe:animate-pop-in data-[state=closed]:motion-safe:animate-pop-out',
].join(' ')

export const menuItem = [
  'relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-[10px] px-3',
  'text-[14px] font-medium text-ink-muted outline-none',
  'transition-[background-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
  'hover:bg-control hover:text-ink',
  'focus:bg-control focus:text-ink',
  'data-[highlighted]:bg-control data-[highlighted]:text-ink',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-55',
].join(' ')

export const menuLabel = 'px-3 py-1.5 text-[12px] font-medium text-ink-faint'

export const menuSeparator = 'my-1 h-px bg-line'
