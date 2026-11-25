import type { AnswerSheetBlock, HeaderHeightsMm, SheetMeta } from '../types'

export type Choice = Extract<AnswerSheetBlock, { type: 'omr_choice' }>
export type Writing = Extract<AnswerSheetBlock, { type: 'lined_writing' }>
export type Mixed = Extract<AnswerSheetBlock, { type: 'mixed_inline' }>

export interface ChoiceRow {
  entries: { block: Choice; span: number; colStart?: number }[]
  bandStart: boolean
  gapBefore: boolean
}

export type RenderItem =
  | { type: 'header'; key: string; meta: SheetMeta; heightsMm?: HeaderHeightsMm }
  | { type: 'choices'; key: string; rows: ChoiceRow[] }
  | {
      type: 'block'
      key: string
      block: AnswerSheetBlock
      start?: number
      end?: number
      monochrome?: boolean
      imageWidthMm?: number
      minHeightMm?: number
      preferredCompositionCols?: number
    }

export interface LayoutItem {
  item: RenderItem
  forceBreak?: boolean
  unitCount: number
  unitStep?: number
  minUnits: number
}

export interface ItemMeasure {
  height: number
  units: number[]
  continuationExtra: number
  lastOnly: number
}

export interface PlacedItem {
  item: RenderItem
  paddingMm: number
  heightMm: number
}

export type LayoutPage = PlacedItem[][]

export interface LayoutSettings {
  lineHeightMm: number
  blockPaddingMm: number
  fontFamily?: string
  gapMm: number
  blankScale: number
}

export interface PaginatedSheetModel {
  pages: LayoutPage[]
  settings: LayoutSettings
  canCompressToPrevPage: boolean
}
