import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const alert = definePrimitive({
  name: 'p0seid0n-alert',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
    title: slot({}),
    description: slot({}),
  }),
})

export const {
  Root: AlertPart,
  Title: AlertTitlePart,
  Description: AlertDescriptionPart,
} = createParts(alert, {
  root: 'div',
  title: 'h5',
  description: 'div',
})
