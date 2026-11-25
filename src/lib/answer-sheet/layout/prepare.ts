import { getColumnSizeMm, type PaperProfile } from '../paper'
import { compositionColumns } from '../render'
import type { AnswerSheetBlock, AnswerSheetLayoutConfig, AnswerSheetSemanticData } from '../types'
import { choiceRows, mixedFlow, writingFlow } from './flow'
import type { Choice, LayoutItem, LayoutSettings, RenderItem } from './model'

export function initialSettings(config?: AnswerSheetLayoutConfig): LayoutSettings {
  const manual = config?.perPaperOverrides[config.activePaperSpec]?.globalLineHeightMm
  const density = config?.densityPreset
  return {
    lineHeightMm: manual ?? (density === 'loose' ? 9.5 : density === 'compact' ? 7.8 : 9),
    blockPaddingMm: density === 'compact' ? 1.8 : 2,
    gapMm: density === 'loose' ? 1.5 : 0,
    blankScale: 1,
  }
}

export function prepareItems(
  data: AnswerSheetSemanticData,
  paper: PaperProfile,
  settings: LayoutSettings,
  config?: AnswerSheetLayoutConfig,
): LayoutItem[] {
  const { widthMm, heightMm } = getColumnSizeMm(paper)
  const overrides = config?.perPaperOverrides[paper.id]?.blockOverrides
  const original = [...data.blocks].sort((a, b) => a.numericOrder - b.numericOrder)
  const capacity = Math.max(1, Math.floor((widthMm - 2 * settings.blockPaddingMm) / 5))
  const factor = Math.max(1, 188 / widthMm)
  const lineCount = (count: number, chars?: number) =>
    Math.max(1, Math.ceil(chars ? chars / capacity : count * factor))
  const items: LayoutItem[] = [
    {
      item: { type: 'header', key: 'header', meta: data.meta, heightsMm: config?.headerHeightsMm },
      unitCount: 0,
      minUnits: 1,
    },
  ]
  let pending: Choice[] = []
  let forced = false
  function flushChoices() {
    if (!pending.length) return
    const key = `choices:${pending[0]?.id}`
    const { rows } = choiceRows(
      pending,
      widthMm,
      settings.blockPaddingMm,
      config?.maxChoicesPerColumn,
    )
    items.push({
      item: { type: 'choices', key, rows },
      forceBreak: forced,
      unitCount: rows.length,
      minUnits: 1,
    })
    pending = []
  }
  for (const block of original) {
    if (block.type !== 'omr_choice') continue
    if (overrides?.[block.id]?.forceBreakBefore) {
      flushChoices()
      forced = true
    }
    pending.push(block)
  }
  flushChoices()
  for (const originalBlock of original) {
    if (originalBlock.type === 'omr_choice') continue
    const override = overrides?.[originalBlock.id]
    let block: AnswerSheetBlock = originalBlock
    let unitCount = 0
    let unitStep: number | undefined
    if (block.type === 'lined_writing') {
      const meta = block.englishWritingMeta
      const subItems = block.subItems?.map((part) => ({
        ...part,
        baseLines: lineCount(part.baseLines, part.estimatedChars),
      }))
      const paragraphs = meta?.continuationParagraphs?.map((part) => ({
        ...part,
        baseLines: lineCount(part.baseLines),
      }))
      const distribute = (counts: number[]) => {
        if (override?.manualLines === undefined) return counts
        const total = Math.max(counts.length, Math.floor(override.manualLines))
        return counts.map(
          (_, index) => Math.floor(total / counts.length) + (index < total % counts.length ? 1 : 0),
        )
      }
      const parts = distribute((paragraphs ?? subItems)?.map((part) => part.baseLines) ?? [])
      paragraphs?.forEach((part, i) => {
        part.baseLines = parts[i] ?? part.baseLines
      })
      if (!paragraphs?.length)
        subItems?.forEach((part, i) => {
          part.baseLines = parts[i] ?? part.baseLines
        })
      block = {
        ...block,
        baseLines: override?.manualLines ?? lineCount(block.baseLines, block.estimatedChars),
        subItems,
        englishWritingMeta: meta && { ...meta, continuationParagraphs: paragraphs },
      }
      unitCount = writingFlow(block).length
      if (unitCount <= 3) unitCount = 0
    } else if (block.type === 'mixed_inline') {
      block = {
        ...block,
        rows: block.rows.map((row) =>
          row.type === 'full_line'
            ? { ...row, lines: lineCount(row.lines, row.estimatedChars) }
            : row,
        ),
      }
      unitCount = mixedFlow(block).length
      if (unitCount <= 3) unitCount = 0
    } else if (block.type === 'composition_grid') {
      unitStep = compositionColumns(widthMm, config?.defaultCompositionCols)
      unitCount = Math.ceil(block.totalGrids / unitStep)
    } else if (block.type === 'open_blank_box') {
      const height =
        override?.manualHeightMm ??
        block.baseHeightMm * (block.attachedAssetIds?.length ? 1 : settings.blankScale)
      block = { ...block, baseHeightMm: Math.min(heightMm - 0.5, height) }
    } else if (block.type === 'drawing_grid') {
      block = {
        ...block,
        baseHeightMm: Math.min(heightMm - 12, override?.manualHeightMm ?? block.baseHeightMm),
      }
    }
    items.push({
      item: {
        type: 'block',
        key: block.id,
        block,
        monochrome: override?.monochrome,
        imageWidthMm: override?.imageWidthMm,
        minHeightMm:
          block.type === 'compact_blank' || block.type === 'mixed_inline'
            ? override?.manualHeightMm
            : undefined,
        preferredCompositionCols: config?.defaultCompositionCols,
      },
      forceBreak: override?.forceBreakBefore,
      unitCount,
      unitStep,
      minUnits: block.type === 'composition_grid' ? 1 : 2,
    })
  }
  return items
}

export function sliceItem(entry: LayoutItem, start: number, end: number): RenderItem {
  const item = entry.item
  if (item.type === 'header' || (start === 0 && end === entry.unitCount)) return item
  if (item.type === 'choices')
    return { ...item, key: `${item.key}:${start}`, rows: item.rows.slice(start, end) }
  const step = entry.unitStep ?? 1
  return { ...item, key: `${item.key}:${start}`, start: start * step, end: end * step }
}
