export interface SpeedtestTarget {
  id: string
  name: string
  builtin?: boolean
  countries?: readonly string[]
  /** HEAD requests go here, idle and under load; defaults to the first download URL. */
  ping: string
  /** Large uncompressed objects for GET throughput streaming. */
  download: readonly string[]
  /** POST sinks discarding request bodies; empty array skips the upload phase. */
  upload: readonly string[]
}

export interface CustomTargetDraft {
  name: string
  ping: string
  downloadText: string
  uploadText: string
}

const CUSTOM_TARGETS_STORAGE_KEY = 'tools:speedtest-custom-targets'
const SELECTED_TARGET_STORAGE_KEY = 'tools:speedtest-selected-target'

export const BUILTIN_TARGETS: readonly SpeedtestTarget[] = [
  {
    id: 'cloudflare-edge',
    name: 'Cloudflare 全球边缘',
    builtin: true,
    ping: 'https://speed.cloudflare.com/__down?bytes=0',
    download: [
      'https://speed.cloudflare.com/__down?bytes=50000000',
      'https://speed.cloudflare.com/__down?bytes=50000000',
    ],
    upload: ['https://speed.cloudflare.com/__up'],
  },
  {
    id: 'cloudflare-light',
    name: 'Cloudflare 轻量（省流）',
    builtin: true,
    ping: 'https://speed.cloudflare.com/__down?bytes=0',
    download: ['https://speed.cloudflare.com/__down?bytes=10000000'],
    upload: ['https://speed.cloudflare.com/__up'],
  },
]

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseUrlList(raw: string): string[] {
  return raw
    .split(/[\r\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function validateCustomTargetDraft(draft: CustomTargetDraft): {
  valid: boolean
  errors: Partial<Record<keyof CustomTargetDraft, string>>
  target?: Omit<SpeedtestTarget, 'id'>
} {
  const errors: Partial<Record<keyof CustomTargetDraft, string>> = {}
  const name = draft.name.trim()
  if (!name) {
    errors.name = '请输入测速源名称'
  }

  const download = parseUrlList(draft.downloadText)
  if (download.length === 0) {
    errors.downloadText = '请至少填写一个下载测速 URL'
  } else if (download.some((url) => !isValidHttpUrl(url))) {
    errors.downloadText = '包含无效的 HTTP(S) 地址'
  }

  const pingRaw = draft.ping.trim()
  if (pingRaw && !isValidHttpUrl(pingRaw)) {
    errors.ping = '请输入有效的 HTTP(S) 延迟探测地址'
  }

  const upload = parseUrlList(draft.uploadText)
  if (upload.some((url) => !isValidHttpUrl(url))) {
    errors.uploadText = '包含无效的 HTTP(S) 上传地址'
  }

  const valid = Object.keys(errors).length === 0
  if (!valid) {
    return { valid: false, errors }
  }

  const firstDownload = download[0]!
  return {
    valid: true,
    errors,
    target: {
      name,
      builtin: false,
      ping: pingRaw || firstDownload,
      download,
      upload,
    },
  }
}

export function loadCustomTargets(): SpeedtestTarget[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_TARGETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((entry): SpeedtestTarget[] => {
      if (typeof entry !== 'object' || entry === null) return []
      const record = entry as Record<string, unknown>
      const id = typeof record.id === 'string' && record.id ? record.id : ''
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      const download = Array.isArray(record.download)
        ? record.download.filter((u): u is string => typeof u === 'string' && isValidHttpUrl(u))
        : []
      const upload = Array.isArray(record.upload)
        ? record.upload.filter((u): u is string => typeof u === 'string' && isValidHttpUrl(u))
        : []
      const ping =
        typeof record.ping === 'string' && isValidHttpUrl(record.ping)
          ? record.ping
          : (download[0] ?? '')

      if (!id || !name || download.length === 0 || !ping) return []
      return [{ id, name, builtin: false, ping, download, upload }]
    })
  } catch {
    return []
  }
}

export function saveCustomTargets(targets: readonly SpeedtestTarget[]): void {
  if (typeof window === 'undefined') return
  try {
    const serializable = targets
      .filter((target) => !target.builtin)
      .map(({ id, name, ping, download, upload }) => ({ id, name, ping, download, upload }))
    window.localStorage.setItem(CUSTOM_TARGETS_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore storage failures.
  }
}

export function loadSelectedTargetId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SELECTED_TARGET_STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveSelectedTargetId(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SELECTED_TARGET_STORAGE_KEY, id)
  } catch {
    // Ignore storage failures.
  }
}
