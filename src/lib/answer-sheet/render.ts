export function compositionColumns(columnWidthMm: number, preferredCols?: number): number {
  const maxUsable = Math.max(1, Math.floor((columnWidthMm - 4) / 6.7))
  if (preferredCols && preferredCols >= 10) {
    return Math.min(maxUsable, preferredCols)
  }
  if (columnWidthMm >= 165) return 25
  if (columnWidthMm >= 150) return 20
  return Math.max(1, Math.min(16, maxUsable))
}
