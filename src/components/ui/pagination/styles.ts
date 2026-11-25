export const paginationButton = [
  'inline-flex h-9 min-w-9 cursor-pointer select-none items-center justify-center gap-1 rounded-control border-0 bg-transparent px-2.5',
  'text-[13px] font-medium text-ink-muted',
  'outline-none hover:bg-control hover:text-ink',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
  'data-disabled:pointer-events-none data-disabled:opacity-55 before:hidden after:hidden',
  'transition-[background-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
].join(' ')

export const paginationItemButton = [
  paginationButton,
  'font-condensed text-[15px] tracking-[-0.01em] tabular-nums',
  'data-current:bg-ink data-current:text-surface data-current:hover:bg-ink data-current:hover:text-surface',
].join(' ')
