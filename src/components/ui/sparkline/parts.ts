import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const sparkline = definePrimitive({
  name: 'p0seid0n-sparkline',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
  }),
})

export const { Root: SparklinePart } = createParts(sparkline, {
  root: 'svg',
})
