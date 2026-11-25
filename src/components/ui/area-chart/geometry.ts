export type AreaTone = 'accent' | 'accent-alt' | 'default' | 'danger'
export type AreaCurve = 'monotone' | 'linear'

export type AreaPoint = {
  x: number
  y: number
  value: number
}

export type AreaPathResult = {
  linePath: string
  areaPath: string
  points: AreaPoint[]
}

export type NormalizedSeries = {
  name: string
  values: number[]
  tone: AreaTone
}

const DEFAULT_TONES: readonly AreaTone[] = ['accent', 'accent-alt', 'default', 'danger']

function sanitizeValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Computes a shared upper bound across one or more series without spreading
 * huge arrays into `Math.max(...)`.
 */
export function niceMax(values: readonly number[], explicitMax?: number): number {
  if (explicitMax !== undefined && Number.isFinite(explicitMax) && explicitMax > 0) {
    return explicitMax
  }
  let highest = 0
  for (let index = 0; index < values.length; index += 1) {
    const current = sanitizeValue(values[index])
    if (current > highest) highest = current
  }
  return highest > 0 ? highest : 1
}

/**
 * Builds SVG line and closed area paths inside a `0 0 width height` viewBox.
 * Uses Fritsch-Carlson monotone cubic tangents when `curve === 'monotone'` so
 * curves never overshoot local extrema.
 */
export function areaPaths(
  values: readonly number[],
  options: { max?: number; curve?: AreaCurve; width?: number; height?: number } = {},
): AreaPathResult {
  const width = options.width ?? 100
  const height = options.height ?? 100
  const curve = options.curve ?? 'monotone'

  if (values.length === 0) {
    return { linePath: '', areaPath: '', points: [] }
  }

  const top = niceMax(values, options.max)
  const padTop = 4
  const usableHeight = Math.max(1, height - padTop)

  if (values.length === 1) {
    const v = sanitizeValue(values[0])
    const y = round(padTop + usableHeight * (1 - clamp(v / top, 0, 1)))
    const linePath = `M0,${y}L${round(width)},${y}`
    const areaPath = `${linePath}L${round(width)},${round(height)}L0,${round(height)}Z`
    return {
      linePath,
      areaPath,
      points: [{ x: round(width / 2), y, value: v }],
    }
  }

  const points: AreaPoint[] = Array.from({ length: values.length }, (_, index) => {
    const v = sanitizeValue(values[index])
    const x = round((index / (values.length - 1)) * width)
    const y = round(padTop + usableHeight * (1 - clamp(v / top, 0, 1)))
    return { x, y, value: v }
  })

  const first = points[0]!
  const last = points[points.length - 1]!
  let linePath = `M${first.x},${first.y}`

  if (curve === 'linear' || points.length === 2) {
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!
      linePath += `L${point.x},${point.y}`
    }
  } else {
    const count = points.length
    const slopes: number[] = Array.from({ length: count - 1 }, (_, index) => {
      const p0 = points[index]!
      const p1 = points[index + 1]!
      const dx = p1.x - p0.x || 1
      return (p1.y - p0.y) / dx
    })

    const tangents: number[] = Array.from({ length: count }, () => 0)
    tangents[0] = slopes[0] ?? 0
    tangents[count - 1] = slopes[count - 2] ?? 0

    for (let index = 1; index < count - 1; index += 1) {
      const prev = slopes[index - 1] ?? 0
      const next = slopes[index] ?? 0
      if (prev * next <= 0) {
        tangents[index] = 0
      } else {
        tangents[index] = (2 * prev * next) / (prev + next)
      }
    }

    for (let index = 0; index < count - 1; index += 1) {
      const p0 = points[index]!
      const p1 = points[index + 1]!
      const dx = p1.x - p0.x
      const cp1x = round(p0.x + dx / 3)
      const cp1y = round(p0.y + ((tangents[index] ?? 0) * dx) / 3)
      const cp2x = round(p1.x - dx / 3)
      const cp2y = round(p1.y - ((tangents[index + 1] ?? 0) * dx) / 3)
      linePath += `C${cp1x},${cp1y},${cp2x},${cp2y},${p1.x},${p1.y}`
    }
  }

  const areaPath = `${linePath}L${last.x},${round(height)}L${first.x},${round(height)}Z`

  return { linePath, areaPath, points }
}

/**
 * Normalises either a single `values` array or tabular `data` rows + `categories`
 * into uniform series descriptors for AreaChart.
 */
export function normalizeAreaData(input: {
  values?: readonly number[]
  data?: readonly Record<string, unknown>[]
  categories?: readonly string[]
  index?: string
  tone?: AreaTone
  tones?: readonly AreaTone[]
}): { labels: string[]; series: NormalizedSeries[]; pointCount: number } {
  if (input.data && input.data.length > 0) {
    const rows = input.data
    const firstRow = rows[0] ?? {}
    const explicitCategories = input.categories?.filter((c) => c.length > 0)
    const inferredCategories =
      explicitCategories && explicitCategories.length > 0
        ? explicitCategories
        : Object.keys(firstRow).filter(
            (key) => key !== input.index && typeof firstRow[key] === 'number',
          )

    const palette = input.tones && input.tones.length > 0 ? input.tones : DEFAULT_TONES
    const labels = rows.map((row, idx) =>
      input.index && row[input.index] != null ? String(row[input.index]) : String(idx + 1),
    )
    const series: NormalizedSeries[] = inferredCategories.map((name, idx) => ({
      name,
      values: rows.map((row) => sanitizeValue(row[name])),
      tone:
        inferredCategories.length === 1 && input.tone
          ? input.tone
          : (palette[idx % palette.length] ?? 'accent'),
    }))

    return { labels, series, pointCount: rows.length }
  }

  const values = input.values ?? []
  const cleaned = values.map((value) => sanitizeValue(value))
  return {
    labels: cleaned.map((_, idx) => String(idx + 1)),
    series:
      cleaned.length > 0 ? [{ name: 'Value', values: cleaned, tone: input.tone ?? 'accent' }] : [],
    pointCount: cleaned.length,
  }
}
