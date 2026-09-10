const HEX_PAIR = '[0-9A-F]{2}'

/**
 * Extract the last four hexadecimal octets from OCR output.
 *
 * Displays often contain either `8F-D8-25-68`, `8F:D8:25:68`, or a full
 * address. Keeping this logic separate from the view makes it easy to test
 * and lets us tolerate the small amount of punctuation noise OCR introduces.
 */
export function extractMacSuffix(input: string): string | null {
  const normalized = input
    .toUpperCase()
    .replace(/[ＯОО]/g, '0')
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/[^0-9A-F:\-\s]/g, ' ')

  const sequences = normalized.match(
    new RegExp(`${HEX_PAIR}(?:[-:\\s]+${HEX_PAIR}){3,}`, 'g'),
  )

  if (sequences?.length) {
    const lastSequence = sequences[sequences.length - 1]
    if (!lastSequence) return null

    const octets = lastSequence.match(/[0-9A-F]{2}/g)
    if (!octets || octets.length < 4) return null

    return octets.slice(-4).join('-')
  }

  const compactSequences = normalized.match(/[0-9A-F]{8,}/g)
  const compactSequence = compactSequences?.[compactSequences.length - 1]
  if (!compactSequence) return null

  const compactOctets = compactSequence.match(/[0-9A-F]{2}/g)
  return compactOctets && compactOctets.length >= 4
    ? compactOctets.slice(-4).join('-')
    : null
}

export function normalizeMacPrefix(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '')
    .slice(0, 4)
    .match(/.{1,2}/g)
    ?.join('-') ?? ''
}

export function buildMacAddress(prefix: string, suffix: string): string {
  const normalizedPrefix = normalizeMacPrefix(prefix)
  return normalizedPrefix ? `${normalizedPrefix}-${suffix}` : suffix
}
