/**
 * Adaptive test duration ported from speed.skk.moe.
 * Throughput is sampled at a fixed 100 ms cadence; the phase ends once a
 * windowed estimate has held steady within 4% for 2 seconds after MIN_DURATION,
 * or at MAX_DURATION.
 */

/** Seconds between throughput samples. */
export const SAMPLE_INTERVAL = 0.1
/** Seconds ignored at the start of a phase while TCP/QUIC slow start ramps up. */
export const WARMUP = 1.5
export const MIN_DURATION = 7
export const MAX_DURATION = 15

/** Samples produced by the minimum duration; the trend chart fills by then and compresses after. */
export const TREND_SAMPLES = Math.round(MIN_DURATION / SAMPLE_INTERVAL)

/** Seconds of samples behind each stability estimate. */
const WINDOW = 3
/** Share of the window's samples dropped from each end before averaging. */
const TRIM = 0.1
/** Seconds of samples behind the reported rate. */
const RESULT_WINDOW = 5
/** Asymmetric trim shares dropping turnover stalls (slow side) and stray bursts (fast side). */
const RESULT_TRIM_SLOW = 0.2
const RESULT_TRIM_FAST = 0.1
/** Seconds of samples behind each point of the chart. */
const CHART_WINDOW = 1.5
const CHART_TRIM_SLOW = RESULT_TRIM_SLOW
const CHART_TRIM_FAST = RESULT_TRIM_FAST
/** Seconds the estimate must stay within TOLERANCE of its latest value. */
const STABLE_FOR = 2
const TOLERANCE = 0.04

const toCount = (seconds: number): number => Math.round(seconds / SAMPLE_INTERVAL)

function trimmedMean(values: readonly number[], slow: number, fast: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const start = Math.floor(sorted.length * slow)
  const end = sorted.length - Math.floor(sorted.length * fast)
  const kept = sorted.slice(start, Math.max(start + 1, end))
  let sum = 0
  for (let i = 0; i < kept.length; i++) {
    sum += kept[i] ?? 0
  }
  return sum / kept.length
}

/** Symmetric trimmed mean of post-warm-up samples in the trailing window; watched by stop rule. */
export function estimate(samples: readonly number[]): number {
  const from = Math.max(toCount(WARMUP), samples.length - toCount(WINDOW))
  if (from >= samples.length) return samples[samples.length - 1] ?? 0
  return trimmedMean(samples.slice(from), TRIM, TRIM)
}

/** Sustained rate reported as the final result and drawn as the reference marker line. */
export function sustained(samples: readonly number[]): number {
  const from = Math.max(toCount(WARMUP), samples.length - toCount(RESULT_WINDOW))
  if (from >= samples.length) return 0
  return trimmedMean(samples.slice(from), RESULT_TRIM_SLOW, RESULT_TRIM_FAST)
}

/** Short-window trimmed mean driving the live area chart curve. */
export function smoothed(samples: readonly number[]): number {
  if (samples.length === 0) return 0
  return trimmedMean(samples.slice(-toCount(CHART_WINDOW)), CHART_TRIM_SLOW, CHART_TRIM_FAST)
}

/** Evaluates whether throughput has stabilized enough to conclude the phase early. */
export function shouldStop(estimates: readonly number[]): boolean {
  const count = estimates.length
  if (count >= toCount(MAX_DURATION)) return true
  if (count < toCount(MIN_DURATION)) return false

  const latest = estimates[estimates.length - 1] ?? 0
  if (latest <= 0) return false
  return estimates
    .slice(count - toCount(STABLE_FOR))
    .every((value) => Math.abs(value - latest) / latest < TOLERANCE)
}
