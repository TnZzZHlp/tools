import type { Choice, ChoiceRow, Mixed, Writing } from './model'

export function choiceRows(
  blocks: Choice[],
  columnWidthMm: number,
  paddingMm = 2,
): { columns: number; rows: ChoiceRow[] } {
  const usable = Math.max(1, columnWidthMm - 2 * paddingMm - 0.6)
  // Minimum track width for a standard 4-option choice group: ~5mm number + 4 * 4.4mm bubbles + gaps = ~29.5mm
  const columns = Math.max(1, Math.floor((usable + 1.8) / 31.5))
  const track = (usable + 1.8) / columns
  const rows: ChoiceRow[] = []

  // Group choice blocks into horizontal bands ONLY when explicitly separated by major sections
  // (e.g. two large sections of >= 10 questions each), otherwise pack together
  const rawGroups: Choice[][] = []
  let currentTag: string | undefined
  for (const block of blocks) {
    if (!rawGroups.length || block.groupTag !== currentTag) {
      rawGroups.push([block])
      currentTag = block.groupTag
    } else {
      rawGroups[rawGroups.length - 1]!.push(block)
    }
  }

  const groups: Choice[][] = []
  for (const g of rawGroups) {
    const prev = groups[groups.length - 1]
    if (!prev || (prev.length >= 10 && g.length >= 10)) {
      groups.push([...g])
    } else {
      prev.push(...g)
    }
  }

  // Split into runs of strictly consecutive numericOrder (curr.numericOrder === prev.numericOrder + 1)
  // and consistent plain-integer displayNo (so e.g. 1..15 stay together, while 18(1) is separate).
  // Also tolerate duplicate/weird numericOrder when displayNo is an integer like "1", "2", "3"..."15".
  function parsePlainInt(text: string): number | null {
    const m = text.trim().match(/^(\d+)$/)
    return m ? Number(m[1]) : null
  }

  function buildConsecutiveRuns(group: Choice[]): Choice[][] {
    const runs: Choice[][] = []
    for (const block of group) {
      const currentRun = runs[runs.length - 1]
      const prevBlock = currentRun?.[currentRun.length - 1]
      if (!currentRun || !prevBlock) {
        runs.push([block])
        continue
      }
      const prevInt = parsePlainInt(prevBlock.displayNo)
      const currInt = parsePlainInt(block.displayNo)
      const isConsecutive =
        prevInt !== null && currInt !== null
          ? currInt === prevInt + 1
          : prevInt === null &&
            currInt === null &&
            block.numericOrder === prevBlock.numericOrder + 1
      if (!isConsecutive) {
        runs.push([block])
      } else {
        currentRun.push(block)
      }
    }
    return runs
  }

  for (const [groupIdx, group] of groups.entries()) {
    const spanMap = new Map<string, number>()
    for (const block of group) {
      const width = Math.max(5.5, block.displayNo.length * 2.5) + block.options.length * 5.4
      const span = Math.min(columns, Math.max(1, Math.ceil((width + 0.8) / track)))
      spanMap.set(block.id, span)
    }

    const runs = buildConsecutiveRuns(group)
    const maxRunLen = runs.reduce((m, r) => Math.max(m, r.length), 1)

    const packWithHeight = (bandHeight: number): ChoiceRow[] => {
      const chunks: Choice[][] = []
      for (const run of runs) {
        // When a consecutive run is long (e.g. 1..15) and splits into columns of bandHeight,
        // distribute items evenly only if bandHeight divides cleanly or keep standard bandHeight vertical slices
        for (let i = 0; i < run.length; i += bandHeight) {
          chunks.push(run.slice(i, i + bandHeight))
        }
      }

      const resultRows: ChoiceRow[] = []
      let cIdx = 0
      let isFirstRowOfGroup = true

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

        for (const entries of bandEntries) {
          if (!entries.length) continue
          resultRows.push({
            entries,
            gapBefore: groupIdx > 0 && isFirstRowOfGroup,
          })
          isFirstRowOfGroup = false
        }
      }
      return resultRows
    }

    let bestRows = packWithHeight(4)
    for (const h of [3, 5]) {
      if (h > Math.max(3, maxRunLen)) continue
      const candidate = packWithHeight(h)
      if (candidate.length < bestRows.length) {
        bestRows = candidate
      }
    }

    rows.push(...bestRows)
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
