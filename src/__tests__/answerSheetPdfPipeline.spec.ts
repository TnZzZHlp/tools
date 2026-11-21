import { expect, it } from 'vitest'
import { assembleOcrPages, runTwoAtATime } from '@/lib/answer-sheet/pdfPipeline'

it('keeps only two OCR units in flight and starts the next unit when either finishes', async () => {
  const gates = new Map<number, () => void>()
  const starts: number[] = []
  const run = runTwoAtATime([1, 2, 3], new AbortController().signal, async (page) => {
    starts.push(page)
    await new Promise<void>((resolve) => {
      gates.set(page, resolve)
    })
  })
  expect(starts).toEqual([1, 2])
  gates.get(2)?.()
  await Promise.resolve()
  await Promise.resolve()
  expect(starts).toEqual([1, 2, 3])
  gates.get(1)?.()
  gates.get(3)?.()
  await run
})

it('blocks assembly while a page is missing and preserves source order after it succeeds', () => {
  const page = (number: number, markdown: string) => ({
    type: 'page' as const,
    result: { page: number, markdown, sourceImages: [] },
    assets: new Map<string, Blob>(),
  })
  const pages = new Map([[2, page(2, '第 1 题的续文\n2. 新题')]])
  expect(() => assembleOcrPages(pages, 2)).toThrow(/第 1 页/)
  pages.set(1, page(1, '语文试卷\n1. 跨页题'))
  expect(assembleOcrPages(pages, 2)).toMatchObject({
    lines: ['语文试卷', '1. 跨页题', '第 1 题的续文', '2. 新题'],
    pageEndLines: [2, 4],
  })
})
