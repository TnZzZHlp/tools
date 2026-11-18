export const paginationButton = [
  'inline-flex h-9 min-w-9 cursor-pointer select-none items-center justify-center gap-1 rounded-control px-2.5',
  'text-[13px] font-medium text-ink-muted',
  'outline-none hover:bg-control hover:text-ink',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
  'disabled:pointer-events-none disabled:opacity-55',
  'transition-[background-color,color] duration-[var(--p0seid0n-duration-fast)] ease-out-expo motion-reduce:transition-none',
].join(' ')

export const paginationItemButton = [
  paginationButton,
  'font-condensed text-[15px] tracking-[-0.01em] tabular-nums',
  'data-[selected]:bg-ink data-[selected]:text-surface data-[selected]:hover:bg-ink data-[selected]:hover:text-surface',
].join(' ')
