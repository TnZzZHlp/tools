import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const table = definePrimitive({
  name: 'p0seid0n-table',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({}),
    header: slot({}),
    body: slot({}),
    footer: slot({}),
    row: slot({}),
    head: slot({}),
    cell: slot({}),
    caption: slot({}),
  }),
})

export const {
  Root: TablePart,
  Header: TableHeaderPart,
  Body: TableBodyPart,
  Footer: TableFooterPart,
  Row: TableRowPart,
  Head: TableHeadPart,
  Cell: TableCellPart,
  Caption: TableCaptionPart,
} = createParts(table, {
  root: 'table',
  header: 'thead',
  body: 'tbody',
  footer: 'tfoot',
  row: 'tr',
  head: 'th',
  cell: 'td',
  caption: 'caption',
})
