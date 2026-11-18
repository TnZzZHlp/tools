import { ping } from './engine'
import type { SpeedtestTarget } from './targets'

function withTimeout(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const onParentAbort = () => controller.abort(parentSignal?.reason)
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }
  }
  const timer = setTimeout(() => controller.abort(new Error('Probe timed out')), timeoutMs)
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
      parentSignal?.removeEventListener('abort', onParentAbort)
    },
  }
}

/** Measures warm HTTP RTT (in ms) for a single target ping URL, returning null if unreachable. */
export async function probePingUrl(
  pingUrl: string,
  signal?: AbortSignal,
  timeoutMs = 3000,
): Promise<number | null> {
  if (signal?.aborted) return null

  const warmup = withTimeout(signal, timeoutMs)
  try {
    await ping(pingUrl, warmup.signal)
  } catch {
    return null
  } finally {
    warmup.cleanup()
  }

  const samples: number[] = []
  const sampleTimeout = Math.min(timeoutMs, 2000)
  for (let i = 0; i < 2; i++) {
    if (signal?.aborted) break
    const attempt = withTimeout(signal, sampleTimeout)
    try {
      const ms = await ping(pingUrl, attempt.signal)
      if (Number.isFinite(ms) && ms >= 0) {
        samples.push(ms)
      }
    } catch {
      // Keep any earlier valid sample; confirm below if only one landed.
    } finally {
      attempt.cleanup()
    }
  }

  if (samples.length === 1 && !signal?.aborted) {
    const confirm = withTimeout(signal, sampleTimeout)
    try {
      const ms = await ping(pingUrl, confirm.signal)
      if (Number.isFinite(ms) && ms >= 0) {
        samples.push(ms)
      } else {
        return null
      }
    } catch {
      return null
    } finally {
      confirm.cleanup()
    }
  }

  if (samples.length === 0) return null
  return Math.min(...samples)
}

/** Computes an optimality score (lower is better; Infinity means ineligible). */
export function scoreTarget(
  target: SpeedtestTarget,
  latencyMs: number | null | undefined,
  countryCode?: string,
): number {
  if (
    target.dataSaver ||
    latencyMs === null ||
    latencyMs === undefined ||
    !Number.isFinite(latencyMs)
  ) {
    return Number.POSITIVE_INFINITY
  }

  let score = latencyMs
  if (target.upload.length === 0) score += 12
  if (target.download.length > 1) score -= 3
  if (countryCode === 'CN' && target.region === 'domestic') {
    score -= 4
  } else if (countryCode && countryCode !== 'CN' && target.region === 'global') {
    score -= 4
  }
  return score
}

/** Returns candidate targets ordered from best reachable node to unprobed regional fallbacks. */
export function rankOptimalTargets(
  targets: readonly SpeedtestTarget[],
  latencies: Readonly<Record<string, number | null | undefined>>,
  countryCode?: string,
  excludedIds?: ReadonlySet<string>,
): SpeedtestTarget[] {
  const eligible = targets.filter((target) => !target.dataSaver && !excludedIds?.has(target.id))

  const reachable = eligible
    .filter((target) => {
      const ms = latencies[target.id]
      return typeof ms === 'number' && Number.isFinite(ms)
    })
    .sort(
      (a, b) =>
        scoreTarget(a, latencies[a.id], countryCode) - scoreTarget(b, latencies[b.id], countryCode),
    )

  const preferDomestic = countryCode === 'CN'
  const unprobed = eligible
    .filter((target) => latencies[target.id] === undefined)
    .sort((a, b) => {
      const aMatch = preferDomestic ? a.region === 'domestic' : a.region === 'global'
      const bMatch = preferDomestic ? b.region === 'domestic' : b.region === 'global'
      if (aMatch === bMatch) return 0
      return aMatch ? -1 : 1
    })

  return [...reachable, ...unprobed]
}

/** Selects the highest-scoring reachable target, falling back by region if no probes have landed. */
export function pickOptimalTarget(
  targets: readonly SpeedtestTarget[],
  latencies: Readonly<Record<string, number | null | undefined>>,
  countryCode?: string,
  excludedIds?: ReadonlySet<string>,
): SpeedtestTarget {
  const ranked = rankOptimalTargets(targets, latencies, countryCode, excludedIds)
  if (ranked[0]) return ranked[0]

  return (
    targets.find((target) => !target.dataSaver && !excludedIds?.has(target.id)) ??
    targets.find((target) => !target.dataSaver) ??
    targets[0]!
  )
}

export interface ProbeTargetsOptions {
  signal?: AbortSignal
  concurrency?: number
  timeoutMs?: number
  onResult?: (targetId: string, latencyMs: number | null) => void
}

/** Probes candidate targets concurrently while deduplicating shared ping URLs. */
export async function probeTargets(
  targets: readonly SpeedtestTarget[],
  options: ProbeTargetsOptions = {},
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {}
  const byUrl = new Map<string, SpeedtestTarget[]>()
  for (const target of targets) {
    const group = byUrl.get(target.ping)
    if (group) {
      group.push(target)
    } else {
      byUrl.set(target.ping, [target])
    }
  }

  const groups = [...byUrl.entries()]
  if (groups.length === 0) return results

  const concurrency = Math.max(1, options.concurrency ?? 5)
  const timeoutMs = options.timeoutMs ?? 3000
  const workerCount = Math.min(concurrency, groups.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      if (options.signal?.aborted) return
      const index = cursor
      cursor += 1
      const entry = groups[index]
      if (!entry) return

      const [pingUrl, groupTargets] = entry
      const latencyMs = await probePingUrl(pingUrl, options.signal, timeoutMs)
      if (options.signal?.aborted) return

      for (const target of groupTargets) {
        results[target.id] = latencyMs
        options.onResult?.(target.id, latencyMs)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
