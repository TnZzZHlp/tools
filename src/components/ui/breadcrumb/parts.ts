import { definePrimitive } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/vue/primitive'

const breadcrumb = definePrimitive({
  name: 'p0seid0n-breadcrumb',
  state: () => ({}),
  api: () => ({}),
  slots: (slot) => ({
    root: slot({ attrs: () => ({ 'aria-label': 'Breadcrumb' }) }),
    list: slot({}),
    item: slot({}),
    link: slot({}),
    current: slot({
      attrs: () => ({ role: 'link', 'aria-disabled': 'true', 'aria-current': 'page' }),
    }),
    separator: slot({ attrs: () => ({ role: 'presentation', 'aria-hidden': 'true' }) }),
    ellipsis: slot({ attrs: () => ({ role: 'presentation', 'aria-hidden': 'true' }) }),
  }),
})

export const {
  Root: BreadcrumbPart,
  List: BreadcrumbListPart,
  Item: BreadcrumbItemPart,
  Link: BreadcrumbLinkPart,
  Current: BreadcrumbPagePart,
  Separator: BreadcrumbSeparatorPart,
  Ellipsis: BreadcrumbEllipsisPart,
} = createParts(breadcrumb, {
  root: 'nav',
  list: 'ol',
  item: 'li',
  link: 'a',
  current: 'span',
  separator: 'li',
  ellipsis: 'span',
})
