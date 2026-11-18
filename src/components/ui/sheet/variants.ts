import { cva } from 'class-variance-authority'

export type SheetSide = 'top' | 'right' | 'bottom' | 'left'

export const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col gap-4 border-line bg-raised p-6 shadow-popup outline-none',
    'motion-safe:animate-sheet-in data-[state=closed]:motion-safe:animate-sheet-out',
  ].join(' '),
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full w-[min(24rem,calc(100vw-2rem))] border-l [--p0seid0n-sheet-x:100%] [--p0seid0n-sheet-y:0%]',
        left: 'inset-y-0 left-0 h-full w-[min(24rem,calc(100vw-2rem))] border-r [--p0seid0n-sheet-x:-100%] [--p0seid0n-sheet-y:0%]',
        top: 'inset-x-0 top-0 w-full border-b [--p0seid0n-sheet-x:0%] [--p0seid0n-sheet-y:-100%]',
        bottom:
          'inset-x-0 bottom-0 w-full border-t [--p0seid0n-sheet-x:0%] [--p0seid0n-sheet-y:100%]',
      } satisfies Record<SheetSide, string>,
    },
    defaultVariants: {
      side: 'right',
    },
  },
)

export const sheetCloseButton = [
  'absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-[10px]',
  'text-[16px] leading-none text-ink-muted',
  'hover:bg-control hover:text-ink active:scale-95 motion-reduce:active:scale-100',
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
  'transition-[background-color,color,transform] duration-[var(--p0seid0n-duration-fast)] ease-spring motion-reduce:transition-none',
].join(' ')
