import { describe, expect, it } from 'vitest'
import type { QuestionGroup } from '@/lib/answer-sheet/review'
import {
  hasAnswerUnderline,
  sanitizeBigQuestionOmrBlocks,
  sanitizeSheetQuestionGroups,
} from '@/lib/answer-sheet/sanitize'
import type { AnswerSheetBlock } from '@/lib/answer-sheet/types'

describe('sanitizeBigQuestionOmrBlocks', () => {
  it('detects markdown, escaped, fullwidth, and LaTeX answer underlines', () => {
    expect(hasAnswerUnderline('该空应填 ____ 。')).toBe(true)
    expect(hasAnswerUnderline('该空应填 \\_\\_\\_\\_ 。')).toBe(true)
    expect(hasAnswerUnderline('该空应填 ＿＿＿＿ 。')).toBe(true)
    expect(hasAnswerUnderline('该空应填 $\\underline{\\quad}$ 。')).toBe(true)
    expect(hasAnswerUnderline('下列选项正确的是（  ）\nA. 甲 B. 乙')).toBe(false)
  })

  it('merges a big-question omr_choice sub-question into sibling mixed_inline when blanks exist', () => {
    const group: QuestionGroup = {
      groupId: 'q-18',
      displayNo: '18',
      sourceMarkdown:
        '18.（12分）实验题：\n（1）自变量是____（A. 光照 B. 温度 C. 湿度）。\n（2）请说明原因____。',
      sourceAssetIds: [],
      blockIds: ['b-18-1', 'b-18-2'],
    }
    const blocks: AnswerSheetBlock[] = [
      {
        id: 'b-18-1',
        displayNo: '18(1)',
        numericOrder: 18,
        score: 2,
        type: 'omr_choice',
        options: ['A', 'B', 'C'],
        isMultiple: false,
      },
      {
        id: 'b-18-2',
        displayNo: '18',
        numericOrder: 18,
        score: 10,
        type: 'mixed_inline',
        rows: [{ type: 'full_line', label: '(2)', lines: 2 }],
      },
    ]

    const result = sanitizeBigQuestionOmrBlocks(group, blocks)
    expect(result.blocks).toHaveLength(1)
    expect(result.group.blockIds).toEqual(['b-18-2'])
    expect(result.blocks[0]).toMatchObject({
      type: 'mixed_inline',
      score: 12,
      rows: [
        {
          type: 'inline_blank',
          segments: [{ label: '(1)', blanksCount: 1, score: 2 }],
        },
        { type: 'full_line', label: '(2)', lines: 2 },
      ],
    })
  })

  it('drops duplicate omr_choice if sibling mixed_inline already contains that sub-question label', () => {
    const group: QuestionGroup = {
      groupId: 'q-18',
      displayNo: '18',
      sourceMarkdown: '18.（1）选____。\n（2）答____。',
      sourceAssetIds: [],
      blockIds: ['b-18-1', 'b-18-2'],
    }
    const blocks: AnswerSheetBlock[] = [
      {
        id: 'b-18-1',
        displayNo: '18(1)',
        numericOrder: 18,
        score: 2,
        type: 'omr_choice',
        options: ['A', 'B', 'C', 'D'],
        isMultiple: false,
      },
      {
        id: 'b-18-2',
        displayNo: '18',
        numericOrder: 18,
        score: 10,
        type: 'mixed_inline',
        rows: [
          { type: 'inline_blank', segments: [{ label: '(1)', blanksCount: 1 }] },
          { type: 'full_line', label: '(2)', lines: 2 },
        ],
      },
    ]

    const result = sanitizeBigQuestionOmrBlocks(group, blocks)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]).toMatchObject({
      type: 'mixed_inline',
      rows: [
        { type: 'inline_blank', segments: [{ label: '(1)', blanksCount: 1 }] },
        { type: 'full_line', label: '(2)', lines: 2 },
      ],
    })
  })

  it('converts a big-question omr_choice to compact_blank when no mixed_inline/compact_blank sibling exists', () => {
    const group: QuestionGroup = {
      groupId: 'q-19',
      displayNo: '19',
      sourceMarkdown: '19.（1）下列叙述正确的是____（填字母）。\n（2）简述理由。',
      sourceAssetIds: [],
      blockIds: ['b-19-1', 'b-19-2'],
    }
    const blocks: AnswerSheetBlock[] = [
      {
        id: 'b-19-1',
        displayNo: '19(1)',
        numericOrder: 19,
        score: 3,
        type: 'omr_choice',
        options: ['A', 'B', 'C', 'D'],
        isMultiple: true,
      },
      {
        id: 'b-19-2',
        displayNo: '19(2)',
        numericOrder: 19,
        score: 5,
        type: 'lined_writing',
        baseLines: 3,
      },
    ]

    const result = sanitizeBigQuestionOmrBlocks(group, blocks)
    expect(result.blocks.some((b) => b.type === 'omr_choice')).toBe(false)
    expect(result.blocks[0]).toMatchObject({
      id: 'b-19-1',
      displayNo: '19(1)',
      type: 'compact_blank',
      preferredColumns: 1,
      items: [{ subNo: '(1)', score: 3 }],
    })
  })

  it('preserves standalone multiple-choice questions even when the stem has a blank underline', () => {
    const group: QuestionGroup = {
      groupId: 'q-21',
      displayNo: '21',
      sourceMarkdown: '21. She ____ to Beijing yesterday.\nA. go  B. goes  C. went  D. going',
      sourceAssetIds: [],
      blockIds: ['b-21'],
    }
    const blocks: AnswerSheetBlock[] = [
      {
        id: 'b-21',
        displayNo: '21',
        numericOrder: 21,
        score: 1.5,
        type: 'omr_choice',
        options: ['A', 'B', 'C', 'D'],
        isMultiple: false,
      },
    ]

    const result = sanitizeBigQuestionOmrBlocks(group, blocks)
    expect(result.blocks).toEqual(blocks)
  })

  it('preserves standalone choice questions in a shared reading group alongside subjective questions', () => {
    const groups: QuestionGroup[] = [
      {
        groupId: 'reading-1',
        displayNo: '1-4',
        sourceMarkdown:
          '阅读下面的文字，完成1~4题。\n1. 下列说法正确的是（  ）\nA. ... B. ...\n4. 请在横线处补写恰当的语句：____。',
        sourceAssetIds: [],
        blockIds: ['b-1', 'b-4'],
      },
    ]
    const blocks: AnswerSheetBlock[] = [
      {
        id: 'b-1',
        displayNo: '1',
        numericOrder: 1,
        score: 3,
        type: 'omr_choice',
        options: ['A', 'B', 'C', 'D'],
        isMultiple: false,
      },
      {
        id: 'b-4',
        displayNo: '4',
        numericOrder: 4,
        score: 4,
        type: 'lined_writing',
        baseLines: 3,
      },
    ]

    const result = sanitizeSheetQuestionGroups(groups, blocks)
    expect(result.blocks[0]?.type).toBe('omr_choice')
    expect(result.blocks[1]?.type).toBe('lined_writing')
  })
})
