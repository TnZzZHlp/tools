import { cva } from 'class-variance-authority'

export type ToggleVariant = 'default' | 'outline'
export type ToggleSize = 'sm' | 'md' | 'lg'

export const toggleVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap',
    'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink',
    'transition-[background-color,color,border-color,transform] duration-[var(--p0seid0n-duration-fast)] ease-spring motion-reduce:transition-none',
    'active:scale-[0.98] motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-55',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-transparent text-ink-muted hover:bg-[color-mix(in_oklab,var(--color-control)_65%,transparent)] hover:text-ink data-[state=on]:bg-control data-[state=on]:text-ink',
        outline:
          'border border-line bg-transparent text-ink-muted hover:bg-control hover:text-ink data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-surface',
      } satisfies Record<ToggleVariant, string>,
      size: {
        sm: 'min-h-8 px-2.5 text-[13px]',
        md: 'min-h-10 px-3.5 text-[14px]',
        lg: 'min-h-11 px-4 text-[15px]',
      } satisfies Record<ToggleSize, string>,
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)
