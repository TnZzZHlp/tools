import type { LayoutSettings } from './layout/model'
import { PAPER_PROFILES, type PaperProfile } from './paper'
import type { AnswerSheetLayoutConfig } from './types'

export const REFERENCE_PAPER: PaperProfile = {
  ...PAPER_PROFILES['8K_2COL'],
  label: '参考答题卡（两栏）',
  widthMm: 386.33,
  heightMm: 267.8,
  columnGapMm: 9,
  marginsMm: { left: 14, right: 14, top: 20, bottom: 21 },
}

export const REFERENCE_SETTINGS: Partial<LayoutSettings> = {
  blockPaddingMm: 2,
  gapMm: 0,
}

export const REFERENCE_LAYOUT: AnswerSheetLayoutConfig = {
  activePaperSpec: '8K_2COL',
  densityPreset: 'normal',
  perPaperOverrides: {
    A3_2COL: { blockOverrides: {} },
    A3_3COL: { blockOverrides: {} },
    '8K_2COL': {
      blockOverrides: Object.fromEntries(
        [
          [4, 2],
          [5, 3],
          [8, 4],
          [9, 3],
          [13, 4],
          [14, 2],
          [16, 3],
          [18, 1],
          [20, 2],
          [21, 3],
        ].map(([no, manualLines]) => [
          `weekend-${no}`,
          { manualLines, forceBreakBefore: no === 9 },
        ]),
      ),
    },
    '8K_B4_2COL': { blockOverrides: {} },
    A4_1COL: { blockOverrides: {} },
  },
}
