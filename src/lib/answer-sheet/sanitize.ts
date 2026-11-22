import type { QuestionGroup } from './review'
import type { AnswerSheetBlock, CompactBlankItem, InlineBlankSegment } from './types'

const ANSWER_UNDERLINE_RE =
  /(?:\\?_){2,}|[＿─━]{2,}|\\underline\s*\{|\\rule\s*\{|\\text\s*\{\s*_+\s*\}/

const SUB_QUESTION_MARKER_RE = /(?:[（(]\s*\d+\s*[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|^\d+\s*[.-]\s*\d+$)/

const BIG_QUESTION_TEXT_RE =
  /(?:[（(]\s*1\s*[)）][\s\S]*[（(]\s*2\s*[)）]|非选择题|解答题|填空题|实验题|材料题|综合题)/

export function hasAnswerUnderline(markdown: string): boolean {
  return ANSWER_UNDERLINE_RE.test(markdown)
}

function extractParentNo(displayNo: string): string {
  const trimmed = displayNo.trim()
  const match = /^(\d+)/.exec(trimmed)
  return match?.[1] ?? trimmed
}

function extractSubLabel(displayNo: string): string {
  const trimmed = displayNo.trim()
  const parenMatch = /([（(]\s*\d+\s*[)）])/.exec(trimmed)
  if (parenMatch?.[1]) {
    return parenMatch[1].replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '')
  }
  const circleMatch = /([①②③④⑤⑥⑦⑧⑨⑩])/.exec(trimmed)
  if (circleMatch?.[1]) return circleMatch[1]
  const dottedMatch = /^\d+\s*[.-]\s*(\d+)$/.exec(trimmed)
  if (dottedMatch?.[1]) return `(${dottedMatch[1]})`
  return ''
}

function extractSubOrder(label: string): number {
  const num = /(\d+)/.exec(label)
  if (num?.[1]) return Number(num[1])
  const circles = '①②③④⑤⑥⑦⑧⑨⑩'
  const idx = circles.indexOf(label.trim())
  return idx >= 0 ? idx + 1 : Number.POSITIVE_INFINITY
}

function normalizeLabelKey(label: string): string {
  return label
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .replace(/[.．、:：]$/, '')
}

function isOmrBlockInsideBigQuestionWithBlank(
  block: Extract<AnswerSheetBlock, { type: 'omr_choice' }>,
  group: QuestionGroup,
  allGroupBlocks: AnswerSheetBlock[],
): boolean {
  if (!hasAnswerUnderline(group.sourceMarkdown)) return false

  const hasSubMarker = SUB_QUESTION_MARKER_RE.test(block.displayNo.trim())
  const parentNo = extractParentNo(block.displayNo)
  const sameParentNonOmr = allGroupBlocks.some(
    (other) => other.type !== 'omr_choice' && extractParentNo(other.displayNo) === parentNo,
  )

  if (hasSubMarker || sameParentNonOmr) {
    return true
  }

  if (allGroupBlocks.length === 1 && BIG_QUESTION_TEXT_RE.test(group.sourceMarkdown)) {
    return true
  }

  return false
}

function mergeIntoMixedInline(
  target: Extract<AnswerSheetBlock, { type: 'mixed_inline' }>,
  omrBlock: Extract<AnswerSheetBlock, { type: 'omr_choice' }>,
): Extract<AnswerSheetBlock, { type: 'mixed_inline' }> {
  const subLabel = extractSubLabel(omrBlock.displayNo) || '(1)'
  const normalizedTarget = normalizeLabelKey(subLabel)

  const alreadyExists = target.rows.some((row) => {
    if (row.type === 'inline_blank') {
      return row.segments.some((seg) => normalizeLabelKey(seg.label) === normalizedTarget)
    }
    if (row.type === 'full_line' && row.label) {
      return normalizeLabelKey(row.label) === normalizedTarget
    }
    return false
  })

  if (alreadyExists) {
    return target
  }

  const newSegment: InlineBlankSegment = {
    label: subLabel,
    blanksCount: 1,
    ...(omrBlock.score !== undefined ? { score: omrBlock.score } : {}),
  }
  const newRow = {
    type: 'inline_blank' as const,
    segments: [newSegment],
  }

  const newOrder = extractSubOrder(subLabel)
  const rows = [...target.rows]
  let insertAt = rows.length
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowLabel =
      row.type === 'inline_blank'
        ? (row.segments[0]?.label ?? '')
        : row.type === 'full_line'
          ? (row.label ?? '')
          : ''
    if (rowLabel && extractSubOrder(rowLabel) > newOrder) {
      insertAt = i
      break
    }
  }
  rows.splice(insertAt, 0, newRow)

  return {
    ...target,
    ...(target.score !== undefined && omrBlock.score !== undefined
      ? { score: Math.round((target.score + omrBlock.score) * 100) / 100 }
      : {}),
    rows,
  }
}

function mergeIntoCompactBlank(
  target: Extract<AnswerSheetBlock, { type: 'compact_blank' }>,
  omrBlock: Extract<AnswerSheetBlock, { type: 'omr_choice' }>,
): Extract<AnswerSheetBlock, { type: 'compact_blank' }> {
  const subNo = extractSubLabel(omrBlock.displayNo) || '(1)'
  const normalizedTarget = normalizeLabelKey(subNo)
  if (target.items.some((item) => normalizeLabelKey(item.subNo) === normalizedTarget)) {
    return target
  }

  const newItem: CompactBlankItem = {
    subNo,
    ...(omrBlock.score !== undefined ? { score: omrBlock.score } : {}),
  }
  const newOrder = extractSubOrder(subNo)
  const items = [...target.items]
  let insertAt = items.length
  for (let i = 0; i < items.length; i++) {
    if (extractSubOrder(items[i]!.subNo) > newOrder) {
      insertAt = i
      break
    }
  }
  items.splice(insertAt, 0, newItem)

  return {
    ...target,
    ...(target.score !== undefined && omrBlock.score !== undefined
      ? { score: Math.round((target.score + omrBlock.score) * 100) / 100 }
      : {}),
    items,
  }
}

function convertOmrToCompactBlank(
  omrBlock: Extract<AnswerSheetBlock, { type: 'omr_choice' }>,
): Extract<AnswerSheetBlock, { type: 'compact_blank' }> {
  const subNo = extractSubLabel(omrBlock.displayNo)
  return {
    id: omrBlock.id,
    displayNo: omrBlock.displayNo,
    numericOrder: omrBlock.numericOrder,
    sectionTitle: omrBlock.sectionTitle,
    score: omrBlock.score,
    type: 'compact_blank',
    preferredColumns: 1,
    items: [{ subNo, ...(omrBlock.score !== undefined ? { score: omrBlock.score } : {}) }],
  }
}

/**
 * Rule: If a big question contains answer underlines (`____`, `\underline{}`, etc.),
 * never place any of its parts into OMR choice bubbles (`omr_choice`).
 * Merge into a sibling `mixed_inline` / `compact_blank` block when available,
 * otherwise convert to a `compact_blank` answer line block.
 */
export function sanitizeBigQuestionOmrBlocks(
  group: QuestionGroup,
  blocks: AnswerSheetBlock[],
): { group: QuestionGroup; blocks: AnswerSheetBlock[] } {
  const omrToConvert = blocks.filter(
    (b): b is Extract<AnswerSheetBlock, { type: 'omr_choice' }> =>
      b.type === 'omr_choice' && isOmrBlockInsideBigQuestionWithBlank(b, group, blocks),
  )

  if (omrToConvert.length === 0) {
    return { group, blocks }
  }

  const convertIds = new Set(omrToConvert.map((b) => b.id))
  const nextBlocks = [...blocks]
  const removedIds = new Set<string>()

  for (const omrBlock of omrToConvert) {
    const parentNo = extractParentNo(omrBlock.displayNo)
    const mixedIdx = nextBlocks.findIndex(
      (b) =>
        b.type === 'mixed_inline' &&
        !convertIds.has(b.id) &&
        (extractParentNo(b.displayNo) === parentNo ||
          extractParentNo(group.displayNo) === parentNo),
    )
    if (mixedIdx >= 0) {
      const target = nextBlocks[mixedIdx]!
      if (target.type === 'mixed_inline') {
        nextBlocks[mixedIdx] = mergeIntoMixedInline(target, omrBlock)
        removedIds.add(omrBlock.id)
        continue
      }
    }

    const compactIdx = nextBlocks.findIndex(
      (b) =>
        b.type === 'compact_blank' &&
        !convertIds.has(b.id) &&
        (extractParentNo(b.displayNo) === parentNo ||
          extractParentNo(group.displayNo) === parentNo),
    )
    if (compactIdx >= 0) {
      const target = nextBlocks[compactIdx]!
      if (target.type === 'compact_blank') {
        nextBlocks[compactIdx] = mergeIntoCompactBlank(target, omrBlock)
        removedIds.add(omrBlock.id)
        continue
      }
    }

    const selfIdx = nextBlocks.findIndex((b) => b.id === omrBlock.id)
    if (selfIdx >= 0) {
      nextBlocks[selfIdx] = convertOmrToCompactBlank(omrBlock)
    }
  }

  const filteredBlocks = nextBlocks.filter((b) => !removedIds.has(b.id))
  const nextGroup: QuestionGroup = {
    ...group,
    blockIds: filteredBlocks.map((b) => b.id),
  }

  return { group: nextGroup, blocks: filteredBlocks }
}

/**
 * Applies `sanitizeBigQuestionOmrBlocks` across all question groups in a full sheet.
 */
export function sanitizeSheetQuestionGroups(
  questionGroups: QuestionGroup[],
  blocks: AnswerSheetBlock[],
): { questionGroups: QuestionGroup[]; blocks: AnswerSheetBlock[] } {
  if (!questionGroups.length || !blocks.length) {
    return { questionGroups, blocks }
  }

  const blockMap = new Map(blocks.map((b) => [b.id, b]))
  const groupedBlockIds = new Set<string>()
  const nextGroups: QuestionGroup[] = []
  const nextBlocks: AnswerSheetBlock[] = []

  for (const group of questionGroups) {
    const groupBlocks = group.blockIds
      .map((id) => blockMap.get(id))
      .filter((b): b is AnswerSheetBlock => Boolean(b))
    for (const b of groupBlocks) groupedBlockIds.add(b.id)

    const sanitized = sanitizeBigQuestionOmrBlocks(group, groupBlocks)
    nextGroups.push(sanitized.group)
    nextBlocks.push(...sanitized.blocks)
  }

  for (const block of blocks) {
    if (!groupedBlockIds.has(block.id)) {
      nextBlocks.push(block)
    }
  }

  return { questionGroups: nextGroups, blocks: nextBlocks }
}
