import { cva } from 'class-variance-authority'

export type AlertVariant = 'neutral' | 'accent' | 'danger'

export const alertVariants = cva(
  'relative flex w-full items-start gap-3 rounded-panel border p-4 text-[14px]',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-raised text-ink',
        accent:
          'border-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-line))] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--color-raised))] text-ink',
        danger:
          'border-[color-mix(in_oklab,var(--color-danger)_45%,var(--color-line))] bg-[color-mix(in_oklab,var(--color-danger)_8%,var(--color-raised))] text-ink',
      } satisfies Record<AlertVariant, string>,
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)
