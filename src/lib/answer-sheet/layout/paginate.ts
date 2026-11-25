import type {
  ItemMeasure,
  LayoutItem,
  LayoutPage,
  LayoutSettings,
  PaginatedSheetModel,
  PlacedItem,
} from './model'
import { sliceItem } from './prepare'

const PAGE_LIMIT = 20
const EPSILON = 0.015

export function paginate(
  items: LayoutItem[],
  measurements: ItemMeasure[],
  columnCount: number,
  columnHeight: number,
  settings: LayoutSettings,
): PaginatedSheetModel {
  const columns: { entries: PlacedItem[]; used: number }[] = []
  const newColumn = () => {
    if (columns.length >= PAGE_LIMIT * columnCount)
      throw new Error('排版超过 20 面，请减少答题内容。')
    const column = { entries: [] as PlacedItem[], used: 0 }
    columns.push(column)
    return column
  }
  let column = newColumn()
  const available = () => columnHeight - column.used - (column.entries.length ? settings.gapMm : 0)
  const place = (entry: LayoutItem, from: number, to: number, heightMm: number) => {
    column.used += heightMm + (column.entries.length ? settings.gapMm : 0)
    column.entries.push({ item: sliceItem(entry, from, to), paddingMm: 0, heightMm })
  }
  for (const [i, entry] of items.entries()) {
    const measure = measurements[i]
    if (!measure) throw new Error('未能测量全部题块。')
    if (entry.forceBreak && column.entries.length) column = newColumn()
    if (measure.height <= available() + EPSILON) {
      place(entry, 0, entry.unitCount, measure.height)
      continue
    }
    if (!entry.unitCount || measure.units.length !== entry.unitCount) {
      if (measure.height > columnHeight + EPSILON)
        throw new Error(`题块 ${entry.item.key} 高于单栏净高。`)
      column = newColumn()
      place(entry, 0, entry.unitCount, measure.height)
      continue
    }
    const sums = [0]
    for (const height of measure.units) sums.push((sums[sums.length - 1] ?? 0) + height)
    const fixed = measure.height - (sums[sums.length - 1] ?? 0)
    const heightAt = (from: number, to: number) =>
      fixed +
      (sums[to] ?? 0) -
      (sums[from] ?? 0) +
      (from ? measure.continuationExtra : 0) -
      (to === entry.unitCount ? 0 : measure.lastOnly)
    let from = 0
    while (from < entry.unitCount) {
      let to = from
      while (to < entry.unitCount && heightAt(from, to + 1) <= available() + EPSILON) to++
      if (entry.unitCount - to < entry.minUnits && to < entry.unitCount)
        to = Math.max(from, entry.unitCount - entry.minUnits)
      if (entry.item.type === 'choices' && to < entry.unitCount) {
        while (to > from && !entry.item.rows[to]?.bandStart) to--
      }
      const required = Math.min(entry.minUnits, entry.unitCount - from)
      if (to - from < required) {
        if (!column.entries.length) throw new Error(`题块 ${entry.item.key} 无法在单栏内拆分。`)
        column = newColumn()
        continue
      }
      place(entry, from, to, heightAt(from, to))
      if (to < entry.unitCount) column = newColumn()
      from = to
    }
  }
  const pages: LayoutPage[] = []
  const finalPageStart = Math.floor((columns.length - 1) / columnCount) * columnCount
  const finalFill =
    columns.slice(finalPageStart).reduce((sum, part) => sum + part.used, 0) /
    (columnHeight * columnCount)
  for (const [i, part] of columns.entries()) {
    const spare = columnHeight - part.used
    if (i < columns.length - 1 && spare > 0 && spare <= 0.18 * columnHeight) {
      const subjective = part.entries.filter(({ item }) => item.type === 'block')
      const weight = subjective.reduce((sum, entry) => sum + Math.sqrt(entry.heightMm), 0)
      for (const entry of subjective) entry.paddingMm = (spare * Math.sqrt(entry.heightMm)) / weight
    }
    if (i % columnCount === 0) pages.push([])
    pages[pages.length - 1]?.push(part.entries)
  }
  return { pages, settings, canCompressToPrevPage: pages.length > 1 && finalFill < 0.2 }
}
