import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const stat = definePrimitive({
  name: 'p0seid0n-stat',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
    label: slot({}),
    'value-row': slot({}),
    value: slot({}),
    unit: slot({}),
    figure: slot({}),
  }),
})

export const {
  Root: StatPart,
  Label: StatLabelPart,
  ValueRow: StatValueRowPart,
  Value: StatValuePart,
  Unit: StatUnitPart,
  Figure: StatFigurePart,
} = createParts(stat, {
  root: 'div',
  label: 'span',
  'value-row': 'div',
  value: 'span',
  unit: 'span',
  figure: 'span',
})
