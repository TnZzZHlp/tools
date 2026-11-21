import { expect, it } from 'vitest'
import { paginate } from '@/lib/answer-sheet/layout/paginate'
import { initialSettings, prepareItems } from '@/lib/answer-sheet/layout/prepare'
import { PAPER_PROFILES } from '@/lib/answer-sheet/paper'
import { previewSamples } from '@/lib/answer-sheet/preview'

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
