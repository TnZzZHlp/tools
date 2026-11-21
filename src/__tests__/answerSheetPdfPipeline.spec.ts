import { expect, it } from 'vitest'
import {
  assembleOcrPages,
  inferSubjectFromText,
  runTwoAtATime,
  sanitizeMetaTitle,
} from '@/lib/answer-sheet/pdfPipeline'

it('keeps up to four OCR units in flight and starts the next unit when any finishes', async () => {
  const gates = new Map<number, () => void>()
  const starts: number[] = []
  const run = runTwoAtATime([1, 2, 3, 4, 5], new AbortController().signal, async (page) => {
    starts.push(page)
    await new Promise<void>((resolve) => {
      gates.set(page, resolve)
    })
  })
  expect(starts).toEqual([1, 2, 3, 4])
  gates.get(2)?.()
  await Promise.resolve()
  await Promise.resolve()
  expect(starts).toEqual([1, 2, 3, 4, 5])
  gates.get(1)?.()
  gates.get(3)?.()
  gates.get(4)?.()
  gates.get(5)?.()
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

it('skips appended answer key and promotional ad pages during OCR assembly and sanitizes notice-line titles', () => {
  const page = (number: number, markdown: string) => ({
    type: 'page' as const,
    result: { page: number, markdown, sourceImages: [] },
    assets: new Map<string, Blob>(),
  })
  const pages = new Map([
    [
      1,
      page(
        1,
        '2025 重庆高考真题\n生物\n注意事项：\n1. 作答前，考生务必将自己的姓名填写在规定位置。',
      ),
    ],
    [2, page(2, '参考答案\n第一部分 选择题\n1-5: BDADD')],
    [3, page(3, '关于我们\n北京高考在线官方网站：www.gaokzx.com 咨询热线：010-57515980')],
  ])
  const assembled = assembleOcrPages(pages, 3)
  expect(assembled.lines).toEqual([
    '2025 重庆高考真题',
    '生物',
    '注意事项：',
    '1. 作答前，考生务必将自己的姓名填写在规定位置。',
  ])
  expect(
    sanitizeMetaTitle(
      '1. 作答前，考生务必将自己的姓名、考场号、座位号填写在试卷的规定位置上。',
      assembled.lines,
      '17538383680892025重庆高考真题生物试题及答案.pdf',
    ),
  ).toBe('2025 重庆高考真题 生物')

  expect(inferSubjectFromText('2025 重庆高考真题\n生 物')).toBe('biology')
  expect(inferSubjectFromText('未命名试卷', '2027届高三语文周末作业试题.pdf')).toBe('chinese')
  expect(inferSubjectFromText('高三思想政治期中联考')).toBe('politics')
})
