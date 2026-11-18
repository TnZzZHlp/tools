import { SAMPLE_INTERVAL, estimate, shouldStop, smoothed, sustained } from './stability'
import type { SpeedtestTarget } from './targets'

export type ThreadMode = 'single' | 'multi'
export type Phase = 'idle' | 'latency' | 'download' | 'upload' | 'done'

/** Live readings while a throughput phase runs, becoming the settled result when it finishes. */
export interface Throughput {
  /** Mbps: the chart's current tip while running, then the sustained result. */
  speed: number | null
  /** Mbps the result is heading for, drawn across the chart; equals speed once settled. */
  sustained: number | null
  /** ms while the link is saturated; null until the first loaded ping lands. */
  latency: number | null
  /** Most recent loaded pings forming the loaded-latency median. */
  pings: number[]
  /** Chart readings, one per sample interval. */
  trend: number[]
  /** Total bytes transferred in this phase. */
  bytes: number
}

export const NOT_STARTED: Throughput = {
  speed: null,
  sustained: null,
  latency: null,
  pings: [],
  trend: [],
  bytes: 0,
}

export interface SpeedtestReport {
  phase: (phase: Phase) => void
  latency: (ms: number | null) => void
  pings: (ms: number[]) => void
  jitter: (ms: number) => void
  download: (throughput: Throughput) => void
  upload: (throughput: Throughput) => void
}

const FETCH_INIT = {
  mode: 'cors',
  referrerPolicy: 'no-referrer',
  cache: 'no-store',
  credentials: 'omit',
} as const satisfies RequestInit

const MULTI_STREAMS_MIN = 6
const MULTI_STREAMS_MAX = 12
const REQUESTS_PER_HOST = 3
const PREFETCH_AT = 0.5
const UPLOAD_STREAMS = 3
const UPLOAD_FIRST_BYTES = 256 * 1024
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024
const UPLOAD_TARGET_SECONDS = 1

export const LATENCY_BUDGET = 2000
const LATENCY_PING_INTERVAL = 50
export const LATENCY_PINGS = LATENCY_BUDGET / LATENCY_PING_INTERVAL
const LOADED_PING_INTERVAL = 200
export const LOADED_POINTS = 40
const LOADED_PING_GRACE = 1500
const RESOURCE_TIMINGS = 2000

const CHART_POLISH = 1 - Math.exp(-SAMPLE_INTERVAL / 0.3)
const SMOOTHING = 1 - Math.exp(-SAMPLE_INTERVAL / 0.6)
const smooth = (shown: number, reading: number): number => shown + (reading - shown) * SMOOTHING
const SETTLE_TICKS = 6
const SETTLE_SMOOTHING = 0.5

// Shared zero-filled upload buffer sliced per request to avoid repeated large allocations.
let sharedUploadBuffer: Uint8Array | null = null
function getUploadPayload(bytes: number): Uint8Array<ArrayBuffer> {
  if (!sharedUploadBuffer || sharedUploadBuffer.byteLength < UPLOAD_MAX_BYTES) {
    sharedUploadBuffer = new Uint8Array(UPLOAD_MAX_BYTES)
  }
  return sharedUploadBuffer.subarray(0, bytes) as Uint8Array<ArrayBuffer>
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function noop(): void {}

export function appendQueryParam(baseUrl: string, key: string, value: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

export function meanAbsoluteDelta(values: readonly number[]): number {
  if (values.length < 2) return 0
  let sum = 0
  for (let i = 1; i < values.length; i++) {
    sum += Math.abs((values[i] ?? 0) - (values[i - 1] ?? 0))
  }
  return sum / (values.length - 1)
}

function landed(slots: ReadonlyArray<number | null>): number[] {
  return slots.filter((ms): ms is number => ms !== null)
}

async function discard(body: ReadableStream<Uint8Array> | null | undefined): Promise<void> {
  if (body != null && typeof body.cancel === 'function') {
    await body.cancel().catch(noop)
  }
}

let nonceCounter = 0
function nextToken(): string {
  nonceCounter += 1
  return `${performance.now().toFixed(3)}-${nonceCounter}`
}

/** Round trip to the ping host: time to response headers via Resource Timing or wall clock. */
export async function ping(targetUrl: string, signal: AbortSignal): Promise<number> {
  const url = appendQueryParam(targetUrl, 'ping', nextToken())
  const started = performance.now()
  let response = await fetch(url, { ...FETCH_INIT, method: 'HEAD', signal })
  if (response.status === 405) {
    // Fallback for static object hosts that disallow HEAD.
    await discard(response.body)
    const fallbackUrl = appendQueryParam(targetUrl, 'ping', nextToken())
    const getStarted = performance.now()
    response = await fetch(fallbackUrl, { ...FETCH_INIT, method: 'GET', signal })
    const getHeadersAt = performance.now()
    if (!response.ok) {
      await discard(response.body)
      throw new Error(`Ping failed: ${response.status}`)
    }
    await discard(response.body)
    const fallbackEntries =
      typeof performance.getEntriesByName === 'function'
        ? performance.getEntriesByName(fallbackUrl, 'resource')
        : []
    const entry = fallbackEntries[fallbackEntries.length - 1] as
      | PerformanceResourceTiming
      | undefined
    return entry && entry.requestStart > 0 && entry.responseStart > 0
      ? entry.responseStart - entry.requestStart
      : getHeadersAt - getStarted
  }
  const headersAt = performance.now()
  if (!response.ok) {
    await discard(response.body)
    throw new Error(`Ping failed: ${response.status}`)
  }
  await discard(response.body)
  const entries =
    typeof performance.getEntriesByName === 'function'
      ? performance.getEntriesByName(url, 'resource')
      : []
  const entry = entries[entries.length - 1] as PerformanceResourceTiming | undefined
  return entry && entry.requestStart > 0 && entry.responseStart > 0
    ? entry.responseStart - entry.requestStart
    : headersAt - started
}

interface Meter {
  flow: (count: number) => void
  transfer: (bytes: number, seconds: number) => void
}

type Pump = (signal: AbortSignal, meter: Meter) => Promise<void>

interface Outcome {
  settled: Promise<void>
}

async function pumpDownload(baseUrl: string, signal: AbortSignal, meter: Meter): Promise<void> {
  const issueRequest = () => {
    const url = appendQueryParam(baseUrl, '_r', nextToken())
    const started = fetch(url, { ...FETCH_INIT, signal })
    started.catch(noop)
    return started
  }

  let pending: Promise<Response> | null = null
  while (!signal.aborted) {
    try {
      const response = await (pending ?? issueRequest())
      if (!response.ok) {
        await discard(response.body)
        throw new Error(`Download failed: ${response.status}`)
      }
      const total = Number(response.headers.get('content-length'))
      let next: Promise<Response> | null = null
      let received = 0
      const reader = response.body ? response.body.getReader() : null
      if (reader !== null) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.byteLength
          meter.flow(value.byteLength)
          if (next === null && total > 0 && received >= total * PREFETCH_AT) {
            next = issueRequest()
          }
        }
      }
      pending = next
    } catch {
      if (signal.aborted) return
      pending = null
      await wait(300)
    }
  }
}

async function pumpUpload(baseUrl: string, signal: AbortSignal, meter: Meter): Promise<void> {
  let bytes = UPLOAD_FIRST_BYTES
  while (!signal.aborted) {
    try {
      const url = appendQueryParam(baseUrl, '_u', nextToken())
      const started = performance.now()
      const response = await fetch(url, {
        ...FETCH_INIT,
        method: 'POST',
        body: getUploadPayload(bytes),
        signal,
      })
      const seconds = Math.max(0.001, (performance.now() - started) / 1000)
      await discard(response.body)
      if (!response.ok) throw new Error(`Upload rejected: ${response.status}`)
      meter.transfer(bytes, seconds)
      bytes = Math.min(
        UPLOAD_MAX_BYTES,
        Math.max(UPLOAD_FIRST_BYTES, Math.round((bytes / seconds) * UPLOAD_TARGET_SECONDS)),
      )
    } catch {
      if (signal.aborted) return
      meter.transfer(0, 1)
      await wait(300)
    }
  }
}

async function measure(
  pumps: readonly Pump[],
  pingTarget: string,
  signal: AbortSignal,
  onProgress: (reading: Throughput) => void,
): Promise<Outcome> {
  const phase = new AbortController()
  const stop = () => phase.abort()
  signal.addEventListener('abort', stop, { once: true })

  let pending = 0
  let acknowledged = 0
  const held: number[] = []
  const streams = pumps.map((start, index) => {
    held.push(0)
    return start(phase.signal, {
      flow(count) {
        pending += count
      },
      transfer(bytes, seconds) {
        acknowledged += bytes
        held[index] = (bytes * 8) / seconds / 1e6
      },
    })
  })

  const pings = new AbortController()
  const abortPings = () => pings.abort()
  signal.addEventListener('abort', abortPings, { once: true })
  const slots: Array<number | null> = []
  const flights: Array<Promise<void>> = []
  let shownLoaded: number | null = null
  let loading = true
  const pingsOver = () => !loading || pings.signal.aborted
  const land = (slot: number, ms: number) => {
    slots[slot] = ms
    shownLoaded = shownLoaded === null ? ms : smooth(shownLoaded, ms)
  }

  const pinger = (async () => {
    for (;;) {
      await wait(LOADED_PING_INTERVAL)
      if (pingsOver()) return
      const slot = slots.push(null) - 1
      flights.push(
        ping(pingTarget, pings.signal)
          .then((ms) => land(slot, ms))
          .catch(noop),
      )
    }
  })()

  const recentPings = () => landed(slots).slice(-LOADED_POINTS)

  const samples: number[] = []
  const estimates: number[] = []
  const trend: number[] = []
  let chartLine = 0
  let marker = 0
  let bytes = 0
  const report = (speed: number, mark: number | null, latency: number | null) => {
    if (!signal.aborted) {
      onProgress({
        speed,
        sustained: mark,
        latency,
        pings: recentPings(),
        trend: [...trend],
        bytes,
      })
    }
  }

  let last = performance.now()
  for (;;) {
    await wait(SAMPLE_INTERVAL * 1000)
    if (phase.signal.aborted) break
    const now = performance.now()
    const elapsedSec = Math.max(0.001, (now - last) / 1000)
    let mbps = (pending * 8) / elapsedSec / 1e6
    for (let i = 0; i < held.length; i++) {
      mbps += held[i] ?? 0
    }
    bytes += pending + acknowledged
    pending = 0
    acknowledged = 0
    last = now

    samples.push(mbps)
    estimates.push(estimate(samples))
    chartLine += (smoothed(samples) - chartLine) * CHART_POLISH
    trend.push(chartLine)
    const rate = sustained(samples)
    marker = marker === 0 ? rate : smooth(marker, rate)
    report(chartLine, marker > 0 ? marker : null, shownLoaded)
    if (shouldStop(estimates)) break
  }

  stop()
  loading = false
  signal.removeEventListener('abort', stop)
  await Promise.allSettled(streams)

  const mbps = sustained(samples)
  const loadedLatency = () => {
    const recent = recentPings()
    return recent.length > 0 ? median(recent) : null
  }

  let shown = chartLine
  for (let tick = 1; tick <= SETTLE_TICKS && !signal.aborted; tick++) {
    await wait(SAMPLE_INTERVAL * 1000)
    shown = tick === SETTLE_TICKS ? mbps : shown + (mbps - shown) * SETTLE_SMOOTHING
    report(shown, mbps, shownLoaded)
  }
  report(mbps, mbps, loadedLatency())

  const settle = async () => {
    if (landed(slots).length === 0) await wait(LOADED_PING_GRACE)
    abortPings()
    await pinger
    await Promise.all(flights)
    signal.removeEventListener('abort', abortPings)
    report(mbps, mbps, loadedLatency())
  }

  return { settled: settle() }
}

/** Runs idle latency + jitter, download throughput, and upload throughput sequentially. */
export async function runSpeedtest(
  mode: ThreadMode,
  target: SpeedtestTarget,
  signal: AbortSignal,
  report: SpeedtestReport,
): Promise<void> {
  if (typeof performance.clearResourceTimings === 'function') {
    performance.clearResourceTimings()
  }
  if (typeof performance.setResourceTimingBufferSize === 'function') {
    performance.setResourceTimingBufferSize(RESOURCE_TIMINGS)
  }

  const slots: Array<number | null> = Array.from({ length: LATENCY_PINGS }, () => null)
  const idle = new AbortController()
  const abortIdle = () => idle.abort()
  signal.addEventListener('abort', abortIdle, { once: true })

  try {
    // First ping warms up DNS/TLS/QUIC and is discarded.
    await ping(target.ping, signal)
    await Promise.all(
      Array.from({ length: LATENCY_PINGS }, async (_, index) => {
        await wait(index * LATENCY_PING_INTERVAL)
        if (idle.signal.aborted) return
        const ms = await ping(target.ping, idle.signal)
        if (idle.signal.aborted) return
        slots[index] = ms
        report.latency(ms)
        report.pings(landed(slots))
      }),
    )
  } catch (error) {
    idle.abort()
    if (!signal.aborted) {
      report.latency(null)
      report.pings([])
    }
    throw error
  } finally {
    signal.removeEventListener('abort', abortIdle)
  }

  const pings = landed(slots)
  report.latency(median(pings))
  report.jitter(meanAbsoluteDelta(pings))

  const downloadPumps: Pump[] = []
  if (mode === 'single') {
    const firstUrl = target.download[0]!
    downloadPumps.push((phaseSignal, meter) => pumpDownload(firstUrl, phaseSignal, meter))
  } else {
    const streamCount = Math.min(
      MULTI_STREAMS_MAX,
      Math.max(MULTI_STREAMS_MIN, target.download.length * REQUESTS_PER_HOST),
    )
    for (let i = 0; i < streamCount; i++) {
      const url = target.download[i % target.download.length]!
      downloadPumps.push((phaseSignal, meter) => pumpDownload(url, phaseSignal, meter))
    }
  }

  report.phase('download')
  const download = await measure(downloadPumps, target.ping, signal, report.download)
  signal.throwIfAborted()

  let upload: Outcome | null = null
  if (target.upload.length > 0) {
    const uploadPumps: Pump[] = []
    const uploadCount = mode === 'multi' ? UPLOAD_STREAMS : 1
    for (let i = 0; i < uploadCount; i++) {
      const url = target.upload[i % target.upload.length]!
      uploadPumps.push((phaseSignal, meter) => pumpUpload(url, phaseSignal, meter))
    }
    report.phase('upload')
    upload = await measure(uploadPumps, target.ping, signal, report.upload)
    signal.throwIfAborted()
  }

  report.phase('done')
  await Promise.all([download.settled, upload?.settled])
}
