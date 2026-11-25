import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const badge = definePrimitive({
  name: 'p0seid0n-badge',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
  }),
})

export const { Root: BadgePart } = createParts(badge, {
  root: 'span',
})
