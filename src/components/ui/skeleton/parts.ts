import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const skeleton = definePrimitive({
  name: 'p0seid0n-skeleton',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({ attrs: () => ({ 'aria-hidden': 'true' }) }),
  }),
})

export const { Root: SkeletonPart } = createParts(skeleton, {
  root: 'div',
})
