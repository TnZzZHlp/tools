/**
 * The trigger strip is a control-height track: 4px inset, 10px item radius, and a
 * raised pill indicator that glides smoothly between active triggers.
 */
export const tabList = [
  'group/tablist relative inline-flex items-center gap-1 rounded-control border-0 bg-control p-1',
  'data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
].join(' ')

export const tabIndicator = [
  'pointer-events-none absolute top-0 left-0 z-0 rounded-[10px] bg-raised shadow-sm',
  'h-[var(--active-tab-height)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] translate-y-[var(--active-tab-top)]',
  'group-data-[ready]/tablist:transition-[translate,width,height] group-data-[ready]/tablist:duration-[var(--p0seid0n-duration-slow)] group-data-[ready]/tablist:ease-spring motion-reduce:transition-none',
].join(' ')

export const tabTrigger = [
  'relative z-10 inline-flex m-0 h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border-0 px-3',
  'text-[13px] font-medium text-ink-muted',
  'hover:text-ink',
  'data-selected:bg-raised data-selected:text-ink data-selected:shadow-sm',
  'group-data-[ready]/tablist:data-selected:bg-transparent group-data-[ready]/tablist:data-selected:shadow-none',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
  'transition-[background-color,color,box-shadow] duration-[var(--p0seid0n-duration-normal)] ease-out-expo motion-reduce:transition-none',
  'data-disabled:pointer-events-none data-disabled:opacity-55',
].join(' ')

export const tabPanel =
  'mt-4 text-[14px] text-ink-muted outline-none data-selected:motion-safe:animate-panel-in'
