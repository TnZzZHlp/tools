/**
 * The trigger strip is a control-height track: 4px inset, 10px item radius, and a
 * raised pill indicator that glides smoothly between active triggers.
 */
export const tabList = [
  'group/tablist relative inline-flex items-center gap-1 rounded-control bg-control p-1',
  'data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
].join(' ')

export const tabIndicator = [
  'pointer-events-none absolute left-0 top-1 z-0 rounded-[10px] bg-raised shadow-sm',
  'h-[var(--reka-tabs-indicator-thickness)] w-[var(--reka-tabs-indicator-size)] translate-x-[var(--reka-tabs-indicator-position)]',
  'group-data-[orientation=vertical]/tablist:left-1 group-data-[orientation=vertical]/tablist:top-0',
  'group-data-[orientation=vertical]/tablist:h-[var(--reka-tabs-indicator-size)] group-data-[orientation=vertical]/tablist:w-[var(--reka-tabs-indicator-thickness)]',
  'group-data-[orientation=vertical]/tablist:translate-x-0 group-data-[orientation=vertical]/tablist:translate-y-[var(--reka-tabs-indicator-position)]',
  'group-data-[ready]/tablist:transition-[translate,width,height] group-data-[ready]/tablist:duration-[var(--p0seid0n-duration-slow)] group-data-[ready]/tablist:ease-spring motion-reduce:transition-none',
].join(' ')

export const tabTrigger = [
  'relative z-10 inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-3',
  'text-[13px] font-medium text-ink-muted',
  'hover:text-ink',
  'data-[state=active]:bg-raised data-[state=active]:text-ink data-[state=active]:shadow-sm',
  'group-data-[ready]/tablist:data-[state=active]:bg-transparent group-data-[ready]/tablist:data-[state=active]:shadow-none',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
  'transition-[background-color,color,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-out-expo motion-reduce:transition-none',
  'disabled:pointer-events-none disabled:opacity-55',
].join(' ')

export const tabPanel =
  'mt-4 text-[14px] text-ink-muted outline-none data-[state=active]:motion-safe:animate-panel-in'
