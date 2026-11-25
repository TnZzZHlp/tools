import type { Choice, ChoiceRow, Mixed, Writing } from './model'

export const MAX_CHOICES_PER_COLUMN = 12

export function isChoicesPerColumn(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_CHOICES_PER_COLUMN
}

export function choiceRows(
  blocks: Choice[],
  columnWidthMm: number,
  paddingMm = 2,
  maxChoicesPerColumn?: number,
): { columns: number; rows: ChoiceRow[] } {
  const usable = Math.max(1, columnWidthMm - 2 * paddingMm - 0.6)
  // Minimum track width for a standard 4-option choice group: ~5mm number + 4 * 4.4mm bubbles + gaps = ~29.5mm
  const columns = Math.max(1, Math.floor((usable + 1.8) / 31.5))
  const track = (usable + 1.8) / columns
  const spanMap = new Map<string, number>()
  for (const block of blocks) {
    const width = Math.max(5.5, block.displayNo.length * 2.5) + block.options.length * 5.4
    const span = Math.min(columns, Math.max(1, Math.ceil((width + 0.8) / track)))
    spanMap.set(block.id, span)
  }

  const packWithHeight = (bandHeight: number): ChoiceRow[] => {
    const chunks: Choice[][] = []
    for (let i = 0; i < blocks.length; i += bandHeight) {
      chunks.push(blocks.slice(i, i + bandHeight))
    }

    const resultRows: ChoiceRow[] = []
    let cIdx = 0

    while (cIdx < chunks.length) {
      const bandEntries: Array<Array<{ block: Choice; span: number; colStart: number }>> =
        Array.from({ length: bandHeight }, () => [])
      let usedColumns = 0

      while (cIdx < chunks.length) {
        const chunk = chunks[cIdx]!
        // The width (column span) of this entire vertical group is determined by the widest question in the group!
        let groupSpan = 1
        for (const blk of chunk) {
          groupSpan = Math.max(groupSpan, spanMap.get(blk.id) ?? 1)
        }
        if (usedColumns + groupSpan > columns) break

        const colStart = usedColumns + 1
        for (let r = 0; r < chunk.length; r++) {
          const blk = chunk[r]!
          bandEntries[r]!.push({
            block: blk,
            span: groupSpan,
            colStart,
          })
        }
        usedColumns += groupSpan
        cIdx++
      }

      for (const [rowIndex, entries] of bandEntries.entries()) {
        if (!entries.length) continue
        resultRows.push({
          entries,
          bandStart: rowIndex === 0,
          gapBefore: rowIndex === 0 && resultRows.length > 0,
        })
      }
    }
    return resultRows
  }

  if (!blocks.length) return { columns, rows: [] }
  if (maxChoicesPerColumn !== undefined && isChoicesPerColumn(maxChoicesPerColumn)) {
    return { columns, rows: packWithHeight(Math.min(maxChoicesPerColumn, blocks.length)) }
  }

  let rows = packWithHeight(4)
  let bands = rows.filter((row) => row.bandStart).length
  for (let height = 3; height <= Math.min(MAX_CHOICES_PER_COLUMN, blocks.length); height++) {
    if (height === 4) continue
    const candidate = packWithHeight(height)
    const candidateBands = candidate.filter((row) => row.bandStart).length
    if (candidateBands < bands || (candidateBands === bands && candidate.length < rows.length)) {
      rows = candidate
      bands = candidateBands
    }
  }
  return { columns, rows }
}

export function writingFlow(block: Writing) {
  const english = block.englishWritingMeta
  const parts = english?.continuationParagraphs?.length
    ? english.continuationParagraphs.map((p) => ({
        count: p.baseLines,
        heading: p.heading,
        leadText: p.leadText,
        label: undefined,
        score: undefined,
      }))
    : block.subItems?.length
      ? block.subItems.map((p) => ({
          count: p.baseLines,
          label: p.label,
          score: p.score,
          heading: undefined,
          leadText: undefined,
        }))
      : [
          {
            count: block.baseLines,
            label: undefined,
            score: undefined,
            heading: undefined,
            leadText: undefined,
          },
        ]
  return parts.flatMap((part) =>
    Array.from({ length: part.count }, (_, index) => ({
      subNo: part.label ?? part.heading,
      label: index === 0 ? part.label : undefined,
      score: index === 0 ? part.score : undefined,
      heading: index === 0 ? part.heading : undefined,
      leadText: index === 0 ? part.leadText : undefined,
    })),
  )
}

export function mixedFlow(block: Mixed) {
  return block.rows.flatMap((row): Mixed['rows'] =>
    row.type === 'full_line'
      ? Array.from({ length: row.lines }, (_, i) => ({
          ...row,
          lines: 1,
          label: i === 0 ? row.label : undefined,
        }))
      : [row],
  )
}
