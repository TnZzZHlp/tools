import type { PaperSize, PaperSpecId } from './types'

export interface PaperProfile extends PaperSize {
  id: PaperSpecId
  label: string
  columns: number
  columnGapMm: number
  marginsMm: { top: number; right: number; bottom: number; left: number }
}

export const PAPER_PROFILES = {
  A3_2COL: {
    id: 'A3_2COL',
    label: 'A3 两栏',
    widthMm: 420,
    heightMm: 297,
    columns: 2,
    columnGapMm: 10,
    marginsMm: { top: 20, right: 15, bottom: 21, left: 15 },
  },
  A3_3COL: {
    id: 'A3_3COL',
    label: 'A3 三栏',
    widthMm: 420,
    heightMm: 297,
    columns: 3,
    columnGapMm: 9,
    marginsMm: { top: 20, right: 15, bottom: 21, left: 15 },
  },
  '8K_2COL': {
    id: '8K_2COL',
    label: '8 开两栏（正度）',
    widthMm: 386.33,
    heightMm: 267.8,
    columns: 2,
    columnGapMm: 9,
    marginsMm: { top: 20, right: 14, bottom: 21, left: 14 },
  },
  '8K_B4_2COL': {
    id: '8K_B4_2COL',
    label: '8 开两栏（B4）',
    widthMm: 364,
    heightMm: 257,
    columns: 2,
    columnGapMm: 10,
    marginsMm: { top: 19, right: 14, bottom: 20, left: 14 },
  },
  A4_1COL: {
    id: 'A4_1COL',
    label: 'A4 单栏',
    widthMm: 210,
    heightMm: 297,
    columns: 1,
    columnGapMm: 0,
    marginsMm: { top: 20, right: 14, bottom: 21, left: 14 },
  },
} as const satisfies Record<PaperSpecId, PaperProfile>

export function getColumnSizeMm(profile: PaperProfile): PaperSize {
  const { widthMm, heightMm, marginsMm, columns, columnGapMm } = profile
  return {
    widthMm: (widthMm - marginsMm.left - marginsMm.right - (columns - 1) * columnGapMm) / columns,
    heightMm: heightMm - marginsMm.top - marginsMm.bottom,
  }
}
