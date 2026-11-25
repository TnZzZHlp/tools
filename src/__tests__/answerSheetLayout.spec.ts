import { expect, it } from 'vitest'
import { createDefaultLayoutConfig } from '@/lib/answer-sheet/draft'
import { paginate } from '@/lib/answer-sheet/layout/paginate'
import { initialSettings, prepareItems } from '@/lib/answer-sheet/layout/prepare'
import { PAPER_PROFILES } from '@/lib/answer-sheet/paper'
import { previewSamples } from '@/lib/answer-sheet/preview'

it('fills objective questions down before moving right at the configured column limit', () => {
  const config = { ...createDefaultLayoutConfig('A4_1COL'), maxChoicesPerColumn: 2 }
  const items = prepareItems(
    previewSamples.chinese,
    PAPER_PROFILES.A4_1COL,
    initialSettings(config),
    config,
  )
  const choices = items.find(({ item }) => item.type === 'choices')?.item
  expect(
    choices?.type === 'choices' &&
      choices.rows
        .slice(0, 2)
        .map(({ entries }) => entries.slice(0, 3).map(({ block }) => block.displayNo)),
  ).toEqual([
    ['1', '3', '5'],
    ['2', '4', '6'],
  ])
})

it('keeps two writing lines together and fits a two-line spill after reducing line height', () => {
  const sheet = {
    ...previewSamples.chinese,
    blocks: [
      {
        id: 'writing',
        type: 'lined_writing' as const,
        displayNo: '1',
        numericOrder: 1,
        baseLines: 29,
      },
    ],
  }
  const profile = PAPER_PROFILES.A4_1COL
  const settings = initialSettings()
  const items = prepareItems(sheet, profile, settings)
  const count = items[1]?.unitCount ?? 0
  const pack = (lineHeightMm: number) =>
    paginate(
      items,
      [
        { height: 37, units: [], continuationExtra: 0, lastOnly: 0 },
        {
          height: 5 + count * lineHeightMm,
          units: Array.from({ length: count }, () => lineHeightMm),
          continuationExtra: 3,
          lastOnly: 0,
        },
      ],
      1,
      268,
      { ...settings, lineHeightMm },
    )

  const original = pack(8)
  expect(original.pages).toHaveLength(2)
  expect(original.pages[1]?.[0]?.[0]?.item).toMatchObject({ key: 'writing:28', start: 28, end: 30 })
  expect(pack(7).pages).toHaveLength(1)
})
