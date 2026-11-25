import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const card = definePrimitive({
  name: 'p0seid0n-card',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
    header: slot({}),
    content: slot({}),
    footer: slot({}),
  }),
})

export const {
  Root: CardPart,
  Header: CardHeaderPart,
  Content: CardContentPart,
  Footer: CardFooterPart,
} = createParts(card, {
  root: 'div',
  header: 'div',
  content: 'div',
  footer: 'div',
})
