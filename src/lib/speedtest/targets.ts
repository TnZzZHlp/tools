export type TargetRegion = 'domestic' | 'global' | 'custom'

export interface SpeedtestTarget {
  id: string
  name: string
  builtin?: boolean
  region?: TargetRegion
  /** Excluded from winning automatic optimal selection (e.g. data-saver mode). */
  dataSaver?: boolean
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

export const AUTO_TARGET_ID = 'auto'

const CUSTOM_TARGETS_STORAGE_KEY = 'tools:speedtest-custom-targets'
const SELECTED_TARGET_STORAGE_KEY = 'tools:speedtest-target-selection'

export const BUILTIN_TARGETS: readonly SpeedtestTarget[] = [
  {
    id: 'cloudflare-edge',
    name: 'Cloudflare 全球边缘',
    builtin: true,
    region: 'global',
    ping: 'https://speed.cloudflare.com/__down?bytes=0',
    download: [
      'https://speed.cloudflare.com/__down?bytes=50000000',
      'https://speed.cloudflare.com/__down?bytes=50000000',
    ],
    upload: ['https://speed.cloudflare.com/__up'],
  },
  {
    id: 'sharktech-us-west',
    name: 'Sharktech 美西 · 洛杉矶',
    builtin: true,
    region: 'global',
    ping: 'https://laxspeed.sharktech.net/backend/empty.php',
    download: [
      'https://laxspeed.sharktech.net/backend/garbage.php?ckSize=50',
      'https://laxspeed.sharktech.net/backend/garbage.php?ckSize=50',
    ],
    upload: ['https://laxspeed.sharktech.net/backend/empty.php'],
  },
  {
    id: 'sharktech-us-central',
    name: 'Sharktech 美中 · 芝加哥 / 丹佛',
    builtin: true,
    region: 'global',
    ping: 'https://chispeed.sharktech.net/backend/empty.php',
    download: [
      'https://chispeed.sharktech.net/backend/garbage.php?ckSize=50',
      'https://denspeed.sharktech.net/backend/garbage.php?ckSize=50',
    ],
    upload: [
      'https://chispeed.sharktech.net/backend/empty.php',
      'https://denspeed.sharktech.net/backend/empty.php',
    ],
  },
  {
    id: 'sharktech-eu-ams',
    name: 'Sharktech 欧洲 · 阿姆斯特丹',
    builtin: true,
    region: 'global',
    ping: 'https://amsspeed.sharktech.net/backend/empty.php',
    download: [
      'https://amsspeed.sharktech.net/backend/garbage.php?ckSize=50',
      'https://amsspeed.sharktech.net/backend/garbage.php?ckSize=50',
    ],
    upload: ['https://amsspeed.sharktech.net/backend/empty.php'],
  },
  {
    id: 'cachefly-global',
    name: 'CacheFly 全球 Anycast',
    builtin: true,
    region: 'global',
    ping: 'https://cachefly.cachefly.net/100mb.test',
    download: [
      'https://cachefly.cachefly.net/100mb.test',
      'https://cachefly.cachefly.net/100mb.test',
    ],
    upload: [],
  },
  {
    id: 'steam-global',
    name: 'Steam 全球分发 (Akamai / CF)',
    builtin: true,
    region: 'global',
    ping: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif',
    download: [
      'https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif',
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif',
    ],
    upload: [],
  },
  {
    id: 'cloudflare-light',
    name: 'Cloudflare 轻量（省流）',
    builtin: true,
    region: 'global',
    dataSaver: true,
    ping: 'https://speed.cloudflare.com/__down?bytes=0',
    download: ['https://speed.cloudflare.com/__down?bytes=10000000'],
    upload: ['https://speed.cloudflare.com/__up'],
  },
  {
    id: 'cn-multi',
    name: '国内多线 · 聚合高速 CDN',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://gcache.migu.cn/prod/upload/game_resource/small_screen2/202508/2700/34/20230323103300677.mp4',
    download: [
      'https://cosbrowser-1253960454.cos.ap-shanghai.myqcloud.com/releases/cosbrowser-setup-2.13.1.exe',
      'https://app.123pan.com/pc-pro/windows/218/123pan_2.1.8.exe',
      'https://image.uc.cn/s/uae/g/3o/broccoli/resource/202401/zry_video.mp4',
      'https://gcache.migu.cn/prod/upload/game_resource/small_screen2/202508/2700/34/20230323103300677.mp4',
    ],
    upload: [],
  },
  {
    id: 'cn-tencent',
    name: '腾讯云 · 上海对象存储 COS',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://cosbrowser-1253960454.cos.ap-shanghai.myqcloud.com/releases/cosbrowser-setup-2.13.1.exe',
    download: [
      'https://cosbrowser-1253960454.cos.ap-shanghai.myqcloud.com/releases/cosbrowser-setup-2.13.1.exe',
    ],
    upload: [],
  },
  {
    id: 'cn-aliyun',
    name: '阿里云 · 国内边缘 CDN',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://image.uc.cn/s/uae/g/3o/broccoli/resource/202401/zry_video.mp4',
    download: ['https://image.uc.cn/s/uae/g/3o/broccoli/resource/202401/zry_video.mp4'],
    upload: [],
  },
  {
    id: 'cn-cmcc',
    name: '中国移动 · 云盘与咪咕 CDN',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://gcache.migu.cn/prod/upload/game_resource/small_screen2/202508/2700/34/20230323103300677.mp4',
    download: [
      'https://yun.mcloud.139.com/mCloud/mCloud_12.6.0_30126032_000.apk',
      'https://gcache.migu.cn/prod/upload/game_resource/small_screen2/202508/2700/34/20230323103300677.mp4',
    ],
    upload: [],
  },
  {
    id: 'cn-123pan',
    name: '123云盘 · 国内多线 CDN',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://app.123pan.com/pc-pro/windows/218/123pan_2.1.8.exe',
    download: ['https://app.123pan.com/pc-pro/windows/218/123pan_2.1.8.exe'],
    upload: [],
  },
  {
    id: 'cn-bilibili',
    name: '哔哩哔哩 / 拼多多 · 国内静态 CDN',
    builtin: true,
    region: 'domestic',
    countries: ['CN'],
    ping: 'https://activity.hdslb.com/blackboard/static/20210604/4d40bc4f98f94fbc71c235832ce3efd4/hJEhL6jGOY.zip',
    download: [
      'https://cd.pddpic.com/android_dev/2023-07-28/5c04772968aee57ca690fbe1e7f29467.apk',
      'https://activity.hdslb.com/blackboard/static/20210604/4d40bc4f98f94fbc71c235832ce3efd4/hJEhL6jGOY.zip',
    ],
    upload: [],
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
      region: 'custom',
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
      return [{ id, name, builtin: false, region: 'custom', ping, download, upload }]
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
