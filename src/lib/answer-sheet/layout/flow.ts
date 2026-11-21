import type { Choice, ChoiceRow, Mixed, Writing } from './model'

export function choiceRows(
  blocks: Choice[],
  columnWidthMm: number,
  paddingMm = 2,
): { columns: number; rows: ChoiceRow[] } {
  const usable = Math.max(1, columnWidthMm - 2 * paddingMm - 0.6)
  const columns = Math.max(1, Math.floor((usable + 2) / 34))
  const track = (usable + 2) / columns
  const rows: ChoiceRow[] = []

  // Group contiguous choice blocks by groupTag
  const groups: Choice[][] = []
  let currentTag: string | undefined
  for (const block of blocks) {
    if (!groups.length || block.groupTag !== currentTag) {
      groups.push([block])
      currentTag = block.groupTag
    } else {
      groups[groups.length - 1]!.push(block)
    }
  }

  for (const [groupIdx, group] of groups.entries()) {
    const spans = group.map((block) => {
      const width = Math.max(7, block.displayNo.length * 2.5) + block.options.length * 5.8
      return Math.min(columns, Math.max(1, Math.ceil((width + 1) / track)))
    })

    // Standard vertical column-major packing (4 rows per column band) matching reference PDFs
    const bandRows = 4
    let i = 0
    let isFirstRowOfGroup = true

    while (i < group.length) {
      const bandEntries: Array<Array<{ block: Choice; span: number }>> = Array.from(
        { length: bandRows },
        () => [],
      )
      const rowRemaining = Array.from({ length: bandRows }, () => columns)

      while (i < group.length) {
        // Peak max span needed by the next up-to-4 items in this vertical column
        const colItemsCount = Math.min(bandRows, group.length - i)
        let colRequiredSpan = 1
        for (let r = 0; r < colItemsCount; r++) {
          colRequiredSpan = Math.max(colRequiredSpan, spans[i + r] ?? 1)
        }
        // Check if current band has room across the needed rows
        const fitsInBand = Array.from(
          { length: colItemsCount },
          (_, r) => rowRemaining[r] ?? 0,
        ).every((rem) => rem >= colRequiredSpan)
        if (!fitsInBand) break

        for (let r = 0; r < colItemsCount; r++) {
          const blk = group[i + r]!
          bandEntries[r]!.push({ block: blk, span: colRequiredSpan })
          rowRemaining[r] = (rowRemaining[r] ?? 0) - colRequiredSpan
        }
        i += colItemsCount
      }

      for (const entries of bandEntries) {
        if (!entries.length) continue
        rows.push({
          entries,
          gapBefore: groupIdx > 0 && isFirstRowOfGroup,
        })
        isFirstRowOfGroup = false
      }
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
