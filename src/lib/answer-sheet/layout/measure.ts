import type { ItemMeasure, LayoutItem, LayoutSettings } from './model'

export const PX_PER_MM = 96 / 25.4
export const mm = (px: number) => px / PX_PER_MM

export function settingsStyle(settings: LayoutSettings) {
  return {
    '--sheet-line-height': `${settings.lineHeightMm}mm`,
    '--sheet-block-padding': `${settings.blockPaddingMm}mm`,
    '--sheet-gap': `${settings.gapMm}mm`,
    '--sheet-font-family': settings.fontFamily,
  }
}

export async function waitForResources(root: HTMLElement): Promise<void> {
  root.getBoundingClientRect()
  await Promise.all([
    document.fonts.ready,
    ...Array.from(root.querySelectorAll('img'), (img) => img.decode().catch(() => undefined)),
  ])
}

function lengths(node: Element) {
  const first = node.firstElementChild
  if (!first) throw new Error('缺少题块测量节点。')
  const height = (element: Element) => mm(element.getBoundingClientRect().height)
  const units = Array.from(first.querySelectorAll(':scope > [data-flow-unit]'), height)
  const lastOnly = Array.from(first.querySelectorAll(':scope > [data-last-only]'), height).reduce(
    (a, b) => a + b,
    0,
  )
  const total = height(first)
  return { height: total, units, lastOnly, fixed: total - units.reduce((a, b) => a + b, 0) }
}

export function measureItems(root: HTMLElement, entries: LayoutItem[]): ItemMeasure[] {
  return entries.map((entry, index) => {
    const element = root.children.item(index)
    const whole = element?.firstElementChild
    if (!whole) throw new Error('离屏测量不完整。')
    const full = lengths(whole)
    const continuation = element.children.item(1)
    const continued = continuation && entry.unitCount > 1 ? lengths(continuation) : null
    return {
      height: full.height,
      units: full.units,
      lastOnly: full.lastOnly,
      continuationExtra: continued
        ? continued.fixed - continued.lastOnly + full.lastOnly - full.fixed
        : 0,
    }
  })
}
