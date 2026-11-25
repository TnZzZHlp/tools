import { slider } from '@ui-sdk/core/slider'
import { createParts } from '@ui-sdk/vue/primitive'

export const { Root: SliderRoot, ThumbInput: SliderThumbInput } = createParts(slider, {
  root: 'div',
  'thumb-input': 'input',
})
