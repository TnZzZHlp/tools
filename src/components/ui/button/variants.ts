import { cva } from 'class-variance-authority'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Button surfaces follow the reference motif: an ink-filled primary, a control-grey
 * secondary, a transparent ghost, and the theme danger colour.
 */
export const buttonVariants = cva(
  [
    'relative isolate inline-flex shrink-0 select-none items-center justify-center gap-2 overflow-hidden',
    'whitespace-nowrap rounded-control font-medium',
    'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-3 focus-visible:outline-ink',
    'transition-[background-color,color,border-color,box-shadow,scale,opacity] duration-[var(--p0seid0n-duration-normal)] ease-spring motion-reduce:transition-none',
    'active:scale-[0.98] disabled:active:scale-100 aria-[disabled=true]:active:scale-100 motion-reduce:active:scale-100',
    'disabled:cursor-default disabled:opacity-55 aria-disabled:cursor-default aria-disabled:opacity-55',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-ink text-surface hover:bg-[color-mix(in_oklab,var(--color-ink)_86%,var(--color-surface))]',
        secondary:
          'bg-control text-ink hover:bg-[color-mix(in_oklab,var(--color-control)_92%,var(--color-ink))]',
        ghost: 'bg-transparent text-ink hover:bg-control',
        danger:
          'bg-danger text-surface hover:bg-[color-mix(in_oklab,var(--color-danger)_86%,var(--color-ink))]',
      } satisfies Record<ButtonVariant, string>,
      size: {
        sm: 'min-h-8 px-3 text-[13px]',
        md: 'min-h-11 px-6 text-[15px]',
        lg: 'min-h-13 px-8 text-[17px]',
      } satisfies Record<ButtonSize, string>,
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)
