const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const twoDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface FormattedUnitValue {
  value: string
  unit: string
}

/** Formats bandwidth in Mbps into split value + unit (Kbps / Mbps / Gbps). */
export function formatBandwidth(mbps: number | null | undefined): FormattedUnitValue | null {
  if (mbps === null || mbps === undefined || !Number.isFinite(mbps)) return null
  const clamped = Math.max(0, mbps)
  if (clamped >= 1000) {
    return { value: twoDecimals.format(clamped / 1000), unit: 'Gbps' }
  }
  if (clamped > 0 && clamped < 1) {
    return { value: oneDecimal.format(clamped * 1000), unit: 'Kbps' }
  }
  return { value: twoDecimals.format(clamped), unit: 'Mbps' }
}

/** Formats byte counters into IEC binary units (B, KiB, MiB, GiB). */
export function formatTraffic(bytes: number): FormattedUnitValue {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { value: '0', unit: 'B' }
  }
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const unit = units[unitIndex] ?? 'B'
  if (unitIndex === 0) {
    return { value: wholeNumber.format(value), unit }
  }
  if (unitIndex >= 3) {
    return { value: twoDecimals.format(value), unit }
  }
  return {
    value: value >= 100 ? wholeNumber.format(value) : oneDecimal.format(value),
    unit,
  }
}

/** Keeps one decimal below 10 ms (9.95 threshold) and whole numbers from 10 ms upward. */
export function formatLatency(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null
  return ms < 9.95 ? oneDecimal.format(ms) : wholeNumber.format(ms)
}

/** Formats jitter with one decimal place. */
export function formatJitter(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null
  return oneDecimal.format(ms)
}
