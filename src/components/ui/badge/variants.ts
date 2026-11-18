import { cva } from 'class-variance-authority'

export type BadgeVariant = 'neutral' | 'accent' | 'accent-alt' | 'outline'

/**
 * The raw download colour sits just below 4.5:1 against surface-coloured text in
 * light mode, so the label is mixed toward the ink instead of the background.
 */
const accentFill = 'bg-[color-mix(in_oklab,var(--color-accent)_88%,var(--color-ink))]'

export const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-[10px] px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
    'transition-[background-color,color,border-color] duration-[var(--p0seid0n-duration-normal)] ease-out-expo motion-reduce:transition-none',
  ].join(' '),
  {
    variants: {
      variant: {
        neutral: 'bg-control text-ink-muted',
        accent: `${accentFill} text-surface`,
        'accent-alt': 'bg-danger text-surface',
        outline: 'border border-line text-ink-muted',
      } satisfies Record<BadgeVariant, string>,
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)
