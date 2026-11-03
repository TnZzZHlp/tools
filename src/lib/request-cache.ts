interface CacheEntry {
  value: unknown
  expiresAt: number
  size: number
}

interface PendingRequest {
  controller: AbortController
  promise: Promise<unknown>
  consumers: number
}

interface CacheOptions {
  ttl: number
  signal?: AbortSignal
  refresh?: boolean
}

const MAX_ENTRIES = 80
const MAX_BYTES = 12 * 1024 * 1024
const entries = new Map<string, CacheEntry>()
const pending = new Map<string, PendingRequest>()
let bytes = 0

function remove(key: string) {
  const entry = entries.get(key)
  if (!entry) return
  bytes -= entry.size
  entries.delete(key)
}

function save(key: string, value: unknown, ttl: number) {
  remove(key)
  const now = Date.now()
  for (const [id, entry] of entries) {
    if (entry.expiresAt <= now) remove(id)
  }
  const size = JSON.stringify(value).length * 2
  if (size > MAX_BYTES) return
  while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) {
    remove(entries.keys().next().value!)
  }
  entries.set(key, { value, expiresAt: now + ttl, size })
  bytes += size
}

export function cachedRequest<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  { ttl, signal, refresh = false }: CacheOptions,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  const cached = entries.get(key)
  if (!refresh && cached && cached.expiresAt > Date.now()) {
    entries.delete(key)
    entries.set(key, cached)
    return Promise.resolve(structuredClone(cached.value) as T)
  }
  if (cached) remove(key)
  let request = pending.get(key)
  if (refresh || !request || request.controller.signal.aborted) {
    const current: PendingRequest = {
      controller: new AbortController(),
      promise: Promise.resolve(),
      consumers: 0,
    }
    pending.set(key, current)
    current.promise = Promise.resolve()
      .then(() => {
        current.controller.signal.throwIfAborted()
        return load(current.controller.signal)
      })
      .then((value) => {
        if (!current.controller.signal.aborted && pending.get(key) === current)
          save(key, value, ttl)
        return value
      })
      .finally(() => {
        if (pending.get(key) === current) pending.delete(key)
      })
    request = current
  }
  const current = request
  return new Promise<unknown>((resolve, reject) => {
    current.consumers++
    let finished = false
    const finish = () => {
      if (finished) return false
      finished = true
      signal?.removeEventListener('abort', onAbort)
      current.consumers--
      if (!current.consumers) {
        if (pending.get(key) === current) pending.delete(key)
        current.controller.abort()
      }
      return true
    }
    const onAbort = () => {
      if (finish()) reject(signal!.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    current.promise.then(
      (value) => {
        if (finish()) resolve(value)
      },
      (cause) => {
        if (finish()) reject(cause)
      },
    )
  }).then((value) => structuredClone(value) as T)
}
