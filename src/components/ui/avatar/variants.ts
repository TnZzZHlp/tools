import { cva } from 'class-variance-authority'

export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarShape = 'circle' | 'square'

export const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-line bg-control font-medium text-ink-muted select-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-[12px]',
        md: 'size-10 text-[13px]',
        lg: 'size-12 text-[15px]',
      } satisfies Record<AvatarSize, string>,
      shape: {
        circle: 'rounded-full',
        square: 'rounded-control',
      } satisfies Record<AvatarShape, string>,
    },
    defaultVariants: {
      size: 'md',
      shape: 'circle',
    },
  },
)
