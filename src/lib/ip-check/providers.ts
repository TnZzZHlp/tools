import {
  computeCSegmentCidr,
  ipToNumericString,
  isPrivateOrReservedIp,
  parseIpVersion,
  toReverseDnsName,
} from './ip-utils'
import type {
  ExitEndpointResult,
  ExitSlotId,
  GeoDatabaseId,
  GeoDatabaseRecord,
  IpInspectionReport,
  IpUsageType,
} from './types'

const REQUEST_TIMEOUT_MS = 6500
const RE_ASN_DIGITS = /(\d+)/
const RE_DATACENTER_KEYWORDS =
  /\b(cloud|hosting|datacenter|data\s*center|vps|server|colo|colocation|cdn|idc|amazon|aws|google\s+llc|microsoft|azure|oracle|digitalocean|vultr|linode|akamai|hetzner|ovh|cloudflare|dmit|leaseweb|choopa|contabo|racknerd|bandwagon|bwh|alibaba|aliyun|tencent)\b/i

const DB_PRIORITY: readonly GeoDatabaseId[] = [
  'ipquery',
  'ipwhois',
  'geojs',
  'freeipapi',
  'ipapi_is',
  'zxinc',
]

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function parseAsnNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  const text = asString(value)
  if (!text) return null
  const match = RE_ASN_DIGITS.exec(text)
  if (!match?.[1]) return null
  const parsed = Number(match[1])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function formatCoords(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return ''
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

async function fetchWithTimeout(
  url: string,
  options: { signal?: AbortSignal; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const onParentAbort = () => controller.abort(options.signal?.reason)

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timer)
      controller.abort(options.signal.reason)
    } else {
      options.signal.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  try {
    return await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: options.headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onParentAbort)
  }
}

async function fetchJson(
  url: string,
  options: { signal?: AbortSignal; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ data: unknown; latencyMs: number }> {
  const started = performance.now()
  const response = await fetchWithTimeout(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data: unknown = await response.json()
  return {
    data,
    latencyMs: Math.max(1, Math.round(performance.now() - started)),
  }
}

async function fetchText(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ text: string; headers: Headers; latencyMs: number }> {
  const started = performance.now()
  const response = await fetchWithTimeout(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const text = await response.text()
  return {
    text,
    headers: response.headers,
    latencyMs: Math.max(1, Math.round(performance.now() - started)),
  }
}

interface DohAnswer {
  type?: number
  data?: string
}

async function queryDohRecords(
  name: string,
  recordType: 'A' | 'AAAA' | 'PTR',
  signal?: AbortSignal,
): Promise<DohAnswer[]> {
  const endpoints = [
    {
      url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${recordType}`,
      headers: { Accept: 'application/dns-json' },
    },
    {
      url: `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${recordType}`,
      headers: { Accept: 'application/json' },
    },
  ]

  let lastError: unknown
  for (const endpoint of endpoints) {
    if (signal?.aborted) break
    try {
      const { data } = await fetchJson(endpoint.url, { signal, headers: endpoint.headers })
      const obj = asRecord(data)
      const status = asNumber(obj.Status)
      if (status !== null && status !== 0 && status !== 3) {
        continue
      }
      if (!Array.isArray(obj.Answer)) return []
      return obj.Answer.map((entry) => {
        const rec = asRecord(entry)
        return {
          type: asNumber(rec.type) ?? undefined,
          data: asString(rec.data),
        }
      })
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error('DoH query failed')
  }
  return []
}

/** Resolves A and AAAA records for a domain using CORS-enabled DoH resolvers. */
export async function resolveDomainIps(domain: string, signal?: AbortSignal): Promise<string[]> {
  const [aResult, aaaaResult] = await Promise.allSettled([
    queryDohRecords(domain, 'A', signal),
    queryDohRecords(domain, 'AAAA', signal),
  ])

  const ips = new Set<string>()
  for (const result of [aResult, aaaaResult]) {
    if (result.status !== 'fulfilled') continue
    for (const answer of result.value) {
      const candidate = answer.data?.trim() ?? ''
      if (parseIpVersion(candidate)) {
        ips.add(candidate)
      }
    }
  }
  return Array.from(ips)
}

/** Looks up reverse DNS PTR hostname for an IPv4/IPv6 address via DoH. */
export async function fetchPtrRecord(ip: string, signal?: AbortSignal): Promise<string | null> {
  const reverseName = toReverseDnsName(ip)
  if (!reverseName) return null
  try {
    const answers = await queryDohRecords(reverseName, 'PTR', signal)
    const ptr = answers.find((item) => item.type === 12 && item.data)
    if (!ptr?.data) return null
    return ptr.data.replace(/\.$/, '') || null
  } catch {
    return null
  }
}

export function createInitialExitSlots(): ExitEndpointResult[] {
  return [
    {
      id: 'domestic',
      label: '国内直连出口',
      subtitle: '国内路由可见公网 IP',
      status: 'loading',
      ip: '',
      ipVersion: null,
      location: '',
      countryCode: '',
      isp: '',
      extra: '',
      latencyMs: null,
    },
    {
      id: 'global-v4',
      label: '海外 / 代理 IPv4',
      subtitle: '国际出口 IPv4 地址',
      status: 'loading',
      ip: '',
      ipVersion: null,
      location: '',
      countryCode: '',
      isp: '',
      extra: '',
      latencyMs: null,
    },
    {
      id: 'ipv6',
      label: 'IPv6 双栈出口',
      subtitle: '客户端 IPv6 连通性',
      status: 'loading',
      ip: '',
      ipVersion: null,
      location: '',
      countryCode: '',
      isp: '',
      extra: '',
      latencyMs: null,
    },
    {
      id: 'cloudflare',
      label: 'Cloudflare 边缘',
      subtitle: 'Cloudflare CDN 接入节点',
      status: 'loading',
      ip: '',
      ipVersion: null,
      location: '',
      countryCode: '',
      isp: '',
      extra: '',
      latencyMs: null,
    },
  ]
}

function joinParts(parts: readonly string[]): string {
  const seen: string[] = []
  for (const part of parts) {
    const clean = part.trim()
    if (clean && !seen.includes(clean)) {
      seen.push(clean)
    }
  }
  return seen.join(' · ')
}

export async function probeClientExitSlot(
  slotId: ExitSlotId,
  signal?: AbortSignal,
): Promise<ExitEndpointResult> {
  const base = createInitialExitSlots().find((item) => item.id === slotId)!

  if (slotId === 'domestic') {
    // 1. myip.ipip.net (supports CORS and returns domestic routing view)
    try {
      const { data, latencyMs } = await fetchJson('https://myip.ipip.net/json', { signal })
      const obj = asRecord(data)
      const inner = asRecord(obj.data)
      const ip = asString(inner.ip)
      const version = parseIpVersion(ip)
      if (obj.ret === 'ok' && version) {
        const loc = Array.isArray(inner.location)
          ? inner.location.map((item) => asString(item))
          : []
        const isp = loc[4] ?? ''
        const geo = joinParts(loc.slice(0, 4))
        return {
          ...base,
          status: 'ok',
          ip,
          ipVersion: version,
          location: geo,
          countryCode: loc[0] === '中国' ? 'CN' : '',
          isp,
          extra: 'IPIP.net 直连视角',
          latencyMs,
        }
      }
    } catch {
      // Fallback to ZXINC
    }

    try {
      const { data, latencyMs } = await fetchJson('https://ip.zxinc.org/api.php?type=json', {
        signal,
      })
      const obj = asRecord(data)
      const inner = asRecord(obj.data)
      const ip = asString(inner.myip)
      const version = parseIpVersion(ip)
      if (version) {
        const countryText = asString(inner.country).replace(/[–\t]+/g, ' · ')
        const localText = asString(inner.local).replace(/\t+/g, ' ')
        return {
          ...base,
          status: 'ok',
          ip,
          ipVersion: version,
          location: countryText,
          countryCode: countryText.startsWith('中国') ? 'CN' : '',
          isp: localText,
          extra: 'ZXINC 直连视角',
          latencyMs,
        }
      }
    } catch (error) {
      return {
        ...base,
        status: 'unavailable',
        error: error instanceof Error ? error.message : '国内出口探测失败',
      }
    }
  }

  if (slotId === 'global-v4') {
    try {
      const { data, latencyMs } = await fetchJson('https://api.ipquery.io/?format=json', {
        signal,
      })
      const obj = asRecord(data)
      const ip = asString(obj.ip)
      if (parseIpVersion(ip) === 4) {
        const loc = asRecord(obj.location)
        const isp = asRecord(obj.isp)
        return {
          ...base,
          status: 'ok',
          ip,
          ipVersion: 4,
          location: joinParts([asString(loc.country), asString(loc.state), asString(loc.city)]),
          countryCode: asString(loc.country_code),
          isp: asString(isp.isp) || asString(isp.org),
          extra: asString(isp.asn),
          latencyMs,
        }
      }
    } catch {
      // Fall back to explicit IPv4-only endpoints
    }

    try {
      const { data, latencyMs } = await fetchJson('https://api.ipify.org?format=json', { signal })
      const ip = asString(asRecord(data).ip)
      if (parseIpVersion(ip) === 4) {
        return {
          ...base,
          status: 'ok',
          ip,
          ipVersion: 4,
          extra: 'api.ipify.org',
          latencyMs,
        }
      }
    } catch {
      // Try icanhazip IPv4
    }

    try {
      const { text, latencyMs } = await fetchText('https://ipv4.icanhazip.com/', { signal })
      const ip = text.trim()
      if (parseIpVersion(ip) === 4) {
        return {
          ...base,
          status: 'ok',
          ip,
          ipVersion: 4,
          extra: 'ipv4.icanhazip.com',
          latencyMs,
        }
      }
    } catch (error) {
      return {
        ...base,
        status: 'unavailable',
        error: error instanceof Error ? error.message : 'IPv4 出口探测失败',
      }
    }
  }

  if (slotId === 'ipv6') {
    let detectedIp = ''
    let detectedLatency: number | null = null

    try {
      const { data, latencyMs } = await fetchJson('https://api6.ipify.org?format=json', {
        signal,
        timeoutMs: 4500,
      })
      const candidate = asString(asRecord(data).ip)
      if (parseIpVersion(candidate) === 6) {
        detectedIp = candidate
        detectedLatency = latencyMs
      }
    } catch {
      try {
        const { text, latencyMs } = await fetchText('https://ipv6.icanhazip.com/', {
          signal,
          timeoutMs: 4500,
        })
        const candidate = text.trim()
        if (parseIpVersion(candidate) === 6) {
          detectedIp = candidate
          detectedLatency = latencyMs
        }
      } catch {
        // No IPv6 connectivity
      }
    }

    if (!detectedIp) {
      return {
        ...base,
        status: 'unavailable',
        error: '当前网络不支持 IPv6 或连接超时',
      }
    }

    // Lightly enrich IPv6 location/ISP from ipquery
    let location = ''
    let countryCode = ''
    let isp = ''
    let extra = 'IPv6 已连通'
    try {
      const { data } = await fetchJson(
        `https://api.ipquery.io/${encodeURIComponent(detectedIp)}?format=json`,
        { signal, timeoutMs: 4000 },
      )
      const obj = asRecord(data)
      const loc = asRecord(obj.location)
      const ispObj = asRecord(obj.isp)
      location = joinParts([asString(loc.country), asString(loc.state), asString(loc.city)])
      countryCode = asString(loc.country_code)
      isp = asString(ispObj.isp) || asString(ispObj.org)
      const asn = asString(ispObj.asn)
      if (asn) extra = asn
    } catch {
      // Keep IPv6 ip even if metadata enrichment fails
    }

    return {
      ...base,
      status: 'ok',
      ip: detectedIp,
      ipVersion: 6,
      location,
      countryCode,
      isp,
      extra,
      latencyMs: detectedLatency,
    }
  }

  // 'cloudflare'
  try {
    const { text, latencyMs } = await fetchText('https://www.cloudflare.com/cdn-cgi/trace', {
      signal,
    })
    const traceMap = new Map<string, string>()
    for (const line of text.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        traceMap.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
      }
    }
    const ip = traceMap.get('ip') ?? ''
    const version = parseIpVersion(ip)
    if (version) {
      const loc = traceMap.get('loc') ?? ''
      const colo = traceMap.get('colo') ?? ''
      const httpVer = traceMap.get('http') ?? ''
      const tlsVer = traceMap.get('tls') ?? ''
      return {
        ...base,
        status: 'ok',
        ip,
        ipVersion: version,
        location: loc ? `${loc}${colo ? ` · ${colo} 节点` : ''}` : colo,
        countryCode: loc,
        isp: 'Cloudflare Anycast',
        extra: joinParts([httpVer.toUpperCase(), tlsVer]),
        latencyMs,
      }
    }
  } catch {
    // Fallback to Cloudflare speedtest headers
  }

  try {
    const started = performance.now()
    const response = await fetchWithTimeout('https://speed.cloudflare.com/__down?bytes=0', {
      signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const ip = asString(response.headers.get('cf-meta-ip'))
    const version = parseIpVersion(ip)
    if (!version) throw new Error('Missing Cloudflare IP header')
    const country = asString(response.headers.get('cf-meta-country'))
    const colo = asString(response.headers.get('cf-meta-colo'))
    const city = asString(response.headers.get('cf-meta-city'))
    return {
      ...base,
      status: 'ok',
      ip,
      ipVersion: version,
      location: joinParts([country, city]),
      countryCode: country,
      isp: colo ? `Cloudflare ${colo}` : 'Cloudflare Edge',
      extra: colo ? `POP ${colo}` : '',
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
    }
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Cloudflare 节点探测失败',
    }
  }

  return base
}

export async function probeAllClientExits(options?: {
  signal?: AbortSignal
  onSlotUpdate?: (slot: ExitEndpointResult) => void
}): Promise<ExitEndpointResult[]> {
  const slots = createInitialExitSlots()
  await Promise.all(
    slots.map(async (slot, index) => {
      const result = await probeClientExitSlot(slot.id, options?.signal)
      slots[index] = result
      if (!options?.signal?.aborted) {
        options?.onSlotUpdate?.(result)
      }
    }),
  )
  return slots
}

function createLoadingDatabases(): GeoDatabaseRecord[] {
  return [
    {
      id: 'ipquery',
      sourceName: 'IPQuery',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
    {
      id: 'ipwhois',
      sourceName: 'IPWhois',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
    {
      id: 'freeipapi',
      sourceName: 'FreeIPAPI',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
    {
      id: 'geojs',
      sourceName: 'GeoJS (MaxMind)',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
    {
      id: 'ipapi_is',
      sourceName: 'IPAPI.is',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
    {
      id: 'zxinc',
      sourceName: 'ZXINC 中文库',
      status: 'loading',
      country: '',
      countryCode: '',
      region: '',
      city: '',
      isp: '',
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs: null,
    },
  ]
}

export function createInitialInspectionReport(ip: string): IpInspectionReport {
  const version = parseIpVersion(ip) ?? 4
  return {
    ip,
    ipVersion: version,
    numericIp: ipToNumericString(ip),
    cSegment: computeCSegmentCidr(ip),
    ptr: null,
    ptrLoading: true,
    country: '',
    countryCode: '',
    region: '',
    city: '',
    timezone: '',
    coordinates: '',
    asn: null,
    asnOrg: '',
    isp: '',
    bgpPrefix: '',
    relatedPrefixes: [],
    rir: '',
    rirCountry: '',
    allocatedPrefix: '',
    allocationDate: '',
    nativeStatus: 'unknown',
    usageType: 'unknown',
    riskScore: null,
    flags: {
      isDatacenter: null,
      isProxy: null,
      isVpn: null,
      isTor: null,
      isMobile: null,
      isBogon: null,
    },
    databases: createLoadingDatabases(),
    bgpLoading: true,
    rirLoading: true,
  }
}

interface ProviderParseMeta {
  riskScore: number | null
  isDatacenter: boolean | null
  isProxy: boolean | null
  isVpn: boolean | null
  isTor: boolean | null
  isMobile: boolean | null
  isBogon: boolean | null
  asnOrg: string
  asnNumber: number | null
}

function emptyMeta(): ProviderParseMeta {
  return {
    riskScore: null,
    isDatacenter: null,
    isProxy: null,
    isVpn: null,
    isTor: null,
    isMobile: null,
    isBogon: null,
    asnOrg: '',
    asnNumber: null,
  }
}

async function querySingleGeoDatabase(
  id: GeoDatabaseId,
  ip: string,
  signal?: AbortSignal,
): Promise<{ record: GeoDatabaseRecord; meta: ProviderParseMeta }> {
  const encodedIp = encodeURIComponent(ip)

  if (id === 'ipquery') {
    const { data, latencyMs } = await fetchJson(`https://api.ipquery.io/${encodedIp}?format=json`, {
      signal,
    })
    const obj = asRecord(data)
    const loc = asRecord(obj.location)
    const ispObj = asRecord(obj.isp)
    const risk = asRecord(obj.risk)
    const asnText = asString(ispObj.asn)
    const asnNumber = parseAsnNumber(asnText)
    const org = asString(ispObj.org)
    const isp = asString(ispObj.isp) || org
    return {
      record: {
        id,
        sourceName: 'IPQuery',
        status: 'ok',
        country: asString(loc.country),
        countryCode: asString(loc.country_code).toUpperCase(),
        region: asString(loc.state),
        city: asString(loc.city),
        isp,
        asn: asnNumber ? `AS${asnNumber}` : asnText,
        coordinates: formatCoords(asNumber(loc.latitude), asNumber(loc.longitude)),
        timezone: asString(loc.timezone),
        latencyMs,
      },
      meta: {
        ...emptyMeta(),
        riskScore: asNumber(risk.risk_score),
        isDatacenter: asBoolean(risk.is_datacenter),
        isProxy: asBoolean(risk.is_proxy),
        isVpn: asBoolean(risk.is_vpn),
        isTor: asBoolean(risk.is_tor),
        isMobile: asBoolean(risk.is_mobile),
        asnOrg: org,
        asnNumber,
      },
    }
  }

  if (id === 'ipwhois') {
    const { data, latencyMs } = await fetchJson(`https://ipwho.is/${encodedIp}`, { signal })
    const obj = asRecord(data)
    if (obj.success === false) {
      throw new Error(asString(obj.message) || 'ipwho.is lookup failed')
    }
    const conn = asRecord(obj.connection)
    const tz = asRecord(obj.timezone)
    const asnNumber = parseAsnNumber(conn.asn)
    const org = asString(conn.org)
    const isp = asString(conn.isp) || org
    return {
      record: {
        id,
        sourceName: 'IPWhois',
        status: 'ok',
        country: asString(obj.country),
        countryCode: asString(obj.country_code).toUpperCase(),
        region: asString(obj.region),
        city: asString(obj.city),
        isp,
        asn: asnNumber ? `AS${asnNumber}` : '',
        coordinates: formatCoords(asNumber(obj.latitude), asNumber(obj.longitude)),
        timezone: asString(tz.id),
        latencyMs,
      },
      meta: {
        ...emptyMeta(),
        asnOrg: org,
        asnNumber,
      },
    }
  }

  if (id === 'freeipapi') {
    const { data, latencyMs } = await fetchJson(
      `https://free.freeipapi.com/api/v1/json/${encodedIp}`,
      { signal },
    )
    const obj = asRecord(data)
    const asnNumber = parseAsnNumber(obj.asn)
    const asnOrg = asString(obj.asnOrganization)
    const timeZones = Array.isArray(obj.timeZones) ? obj.timeZones : []
    return {
      record: {
        id,
        sourceName: 'FreeIPAPI',
        status: 'ok',
        country: asString(obj.countryName),
        countryCode: asString(obj.countryCode).toUpperCase(),
        region: asString(obj.regionName),
        city: asString(obj.cityName),
        isp: asnOrg,
        asn: asnNumber ? `AS${asnNumber}` : '',
        coordinates: formatCoords(asNumber(obj.latitude), asNumber(obj.longitude)),
        timezone: timeZones.length === 1 ? asString(timeZones[0]) : '',
        latencyMs,
      },
      meta: {
        ...emptyMeta(),
        isProxy: asBoolean(obj.isProxy),
        asnOrg,
        asnNumber,
      },
    }
  }

  if (id === 'geojs') {
    const { data, latencyMs } = await fetchJson(
      `https://get.geojs.io/v1/ip/geo/${encodedIp}.json`,
      { signal },
    )
    const obj = asRecord(data)
    const asnNumber = parseAsnNumber(obj.asn)
    const orgName = asString(obj.organization_name) || asString(obj.organization)
    return {
      record: {
        id,
        sourceName: 'GeoJS (MaxMind)',
        status: 'ok',
        country: asString(obj.country),
        countryCode: asString(obj.country_code).toUpperCase(),
        region: asString(obj.region),
        city: asString(obj.city),
        isp: orgName,
        asn: asnNumber ? `AS${asnNumber}` : '',
        coordinates: formatCoords(asNumber(obj.latitude), asNumber(obj.longitude)),
        timezone: asString(obj.timezone),
        latencyMs,
      },
      meta: {
        ...emptyMeta(),
        asnOrg: orgName,
        asnNumber,
      },
    }
  }

  if (id === 'ipapi_is') {
    const { data, latencyMs } = await fetchJson(`https://api.ipapi.is/?q=${encodedIp}`, { signal })
    const obj = asRecord(data)
    const asnText = asString(obj.asn)
    const asnNumber = parseAsnNumber(asnText)
    const company = asString(obj.company)
    const cleanedAsnOrg = asnText.replace(/^AS\d+\s*/i, '').trim()
    return {
      record: {
        id,
        sourceName: 'IPAPI.is',
        status: 'ok',
        country: asString(obj.country),
        countryCode: '',
        region: asString(obj.region),
        city: asString(obj.city),
        isp: cleanedAsnOrg || company,
        asn: asnNumber ? `AS${asnNumber}` : asnText,
        coordinates: formatCoords(asNumber(obj.lat), asNumber(obj.lon)),
        timezone: asString(obj.timezone),
        latencyMs,
      },
      meta: {
        ...emptyMeta(),
        isBogon: asBoolean(obj.is_bogon),
        asnOrg: company || cleanedAsnOrg,
        asnNumber,
      },
    }
  }

  // 'zxinc'
  const { data, latencyMs } = await fetchJson(
    `https://ip.zxinc.org/api.php?type=json&ip=${encodedIp}`,
    { signal },
  )
  const obj = asRecord(data)
  if (obj.code !== 0) {
    throw new Error('ZXINC returned non-zero status')
  }
  const inner = asRecord(obj.data)
  const rawCountry = asString(inner.country)
  const parts = rawCountry
    .split(/[–\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const country = parts[0] ?? rawCountry
  const region = parts[1] ?? ''
  const city = parts[parts.length - 1] && parts.length > 2 ? (parts[parts.length - 1] ?? '') : ''
  const local = asString(inner.local).replace(/\t+/g, ' · ')

  let countryCode = ''
  if (
    country === '中国' &&
    !region.includes('香港') &&
    !region.includes('台湾') &&
    !region.includes('澳门')
  ) {
    countryCode = 'CN'
  }

  return {
    record: {
      id,
      sourceName: 'ZXINC 中文库',
      status: 'ok',
      country,
      countryCode,
      region,
      city,
      isp: local,
      asn: '',
      coordinates: '',
      timezone: '',
      latencyMs,
    },
    meta: emptyMeta(),
  }
}

function recomputeSummary(
  report: IpInspectionReport,
  metas: Partial<Record<GeoDatabaseId, ProviderParseMeta>>,
  bgpAsn: { asn: number | null; holder: string },
) {
  const orderedRecords = DB_PRIORITY.map((id) =>
    report.databases.find((db) => db.id === id),
  ).filter((db): db is GeoDatabaseRecord => Boolean(db && db.status === 'ok'))

  // Majority vote on ISO countryCode
  const voteCounts = new Map<string, number>()
  for (const rec of orderedRecords) {
    if (rec.countryCode.length === 2) {
      voteCounts.set(rec.countryCode, (voteCounts.get(rec.countryCode) ?? 0) + 1)
    }
  }

  let bestCountryCode = ''
  let bestVotes = 0
  for (const rec of orderedRecords) {
    const code = rec.countryCode
    if (code.length !== 2) continue
    const votes = voteCounts.get(code) ?? 0
    if (votes > bestVotes) {
      bestVotes = votes
      bestCountryCode = code
    }
  }

  const primaryByCode = bestCountryCode
    ? orderedRecords.find((rec) => rec.countryCode === bestCountryCode)
    : undefined
  const firstWithCountry = primaryByCode ?? orderedRecords.find((rec) => rec.country !== '')

  report.countryCode = bestCountryCode
  report.country = firstWithCountry?.country ?? ''
  report.region =
    orderedRecords.find(
      (rec) => (!bestCountryCode || rec.countryCode === bestCountryCode) && rec.region,
    )?.region ??
    orderedRecords.find((rec) => rec.region)?.region ??
    ''
  report.city =
    orderedRecords.find(
      (rec) => (!bestCountryCode || rec.countryCode === bestCountryCode) && rec.city,
    )?.city ??
    orderedRecords.find((rec) => rec.city)?.city ??
    ''
  report.timezone = orderedRecords.find((rec) => rec.timezone)?.timezone ?? ''
  report.coordinates = orderedRecords.find((rec) => rec.coordinates)?.coordinates ?? ''
  report.isp = orderedRecords.find((rec) => rec.isp)?.isp ?? ''

  // ASN + Org
  const metaAsn =
    metas.ipquery?.asnNumber ??
    metas.ipwhois?.asnNumber ??
    metas.geojs?.asnNumber ??
    metas.freeipapi?.asnNumber ??
    metas.ipapi_is?.asnNumber ??
    bgpAsn.asn
  report.asn = metaAsn
  report.asnOrg =
    bgpAsn.holder ||
    metas.ipquery?.asnOrg ||
    metas.ipwhois?.asnOrg ||
    metas.geojs?.asnOrg ||
    metas.freeipapi?.asnOrg ||
    metas.ipapi_is?.asnOrg ||
    ''

  // Flags & Risk Score
  const isProxyCombined =
    metas.ipquery?.isProxy === true || metas.freeipapi?.isProxy === true
      ? true
      : metas.ipquery?.isProxy === false || metas.freeipapi?.isProxy === false
        ? false
        : null

  const combinedIspLabel = `${report.isp} ${report.asnOrg}`
  let isDatacenter = metas.ipquery?.isDatacenter ?? null
  if (isDatacenter === null && combinedIspLabel.trim()) {
    isDatacenter = RE_DATACENTER_KEYWORDS.test(combinedIspLabel) ? true : null
  }

  report.flags = {
    isDatacenter,
    isProxy: isProxyCombined,
    isVpn: metas.ipquery?.isVpn ?? null,
    isTor: metas.ipquery?.isTor ?? null,
    isMobile: metas.ipquery?.isMobile ?? null,
    isBogon: metas.ipapi_is?.isBogon ?? null,
  }
  report.riskScore = metas.ipquery?.riskScore ?? null

  // Native vs Broadcast determination
  if (report.flags.isBogon) {
    report.nativeStatus = 'bogon'
  } else if (report.rirCountry && report.countryCode) {
    report.nativeStatus =
      report.rirCountry.toUpperCase() === report.countryCode.toUpperCase() ? 'native' : 'broadcast'
  } else {
    report.nativeStatus = 'unknown'
  }

  // Usage Type classification
  let usageType: IpUsageType = 'unknown'
  if (report.flags.isBogon) {
    usageType = 'bogon'
  } else if (report.flags.isMobile) {
    usageType = 'mobile'
  } else if (report.flags.isDatacenter) {
    usageType = 'datacenter'
  } else if (report.flags.isDatacenter === false && (report.isp || report.asnOrg)) {
    usageType = 'residential'
  }
  report.usageType = usageType
}

function cloneReport(report: IpInspectionReport): IpInspectionReport {
  return {
    ...report,
    flags: { ...report.flags },
    relatedPrefixes: [...report.relatedPrefixes],
    databases: report.databases.map((db) => ({ ...db })),
  }
}

/** Runs concurrent multi-source GeoIP, RIR, BGP, PTR, and risk inspection for an IP address. */
export async function inspectIpAddress(
  ip: string,
  options?: {
    signal?: AbortSignal
    onUpdate?: (report: IpInspectionReport) => void
  },
): Promise<IpInspectionReport> {
  const report = createInitialInspectionReport(ip)

  if (isPrivateOrReservedIp(ip)) {
    report.ptrLoading = false
    report.bgpLoading = false
    report.rirLoading = false
    report.country = '本地 / 保留网段'
    report.isp = 'Private / Reserved Network'
    report.nativeStatus = 'bogon'
    report.usageType = 'bogon'
    report.riskScore = 0
    report.flags = {
      isDatacenter: false,
      isProxy: false,
      isVpn: false,
      isTor: false,
      isMobile: false,
      isBogon: true,
    }
    report.databases = report.databases.map((db) => ({
      ...db,
      status: 'error',
      error: '私有/保留 IP 不参与公网库查询',
    }))
    const snapshot = cloneReport(report)
    options?.onUpdate?.(snapshot)
    return snapshot
  }

  const metas: Partial<Record<GeoDatabaseId, ProviderParseMeta>> = {}
  const bgpAsn: { asn: number | null; holder: string } = { asn: null, holder: '' }

  const emitUpdate = () => {
    if (options?.signal?.aborted) return
    recomputeSummary(report, metas, bgpAsn)
    options?.onUpdate?.(cloneReport(report))
  }

  const dbTasks = report.databases.map(async (initialDb, index) => {
    try {
      const { record, meta } = await querySingleGeoDatabase(initialDb.id, ip, options?.signal)
      report.databases[index] = record
      metas[initialDb.id] = meta
    } catch (error) {
      report.databases[index] = {
        ...initialDb,
        status: 'error',
        error: error instanceof Error ? error.message : '请求失败',
      }
    }
    emitUpdate()
  })

  const rirTask = (async () => {
    try {
      const { data } = await fetchJson(
        `https://stat.ripe.net/data/rir/data.json?resource=${encodeURIComponent(ip)}&lod=2`,
        { signal: options?.signal },
      )
      const root = asRecord(data)
      const body = asRecord(root.data)
      const rirs = Array.isArray(body.rirs) ? body.rirs : []
      const first = asRecord(rirs[0])
      report.rir = asString(first.rir)
      report.rirCountry = asString(first.country).toUpperCase()
      report.allocatedPrefix = asString(first.resource)
      const reg = asString(first.registration)
      report.allocationDate = reg ? reg.slice(0, 10) : ''
    } catch {
      // Leave RIR empty on error
    } finally {
      report.rirLoading = false
      emitUpdate()
    }
  })()

  const bgpTask = (async () => {
    try {
      const { data } = await fetchJson(
        `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(ip)}`,
        { signal: options?.signal },
      )
      const root = asRecord(data)
      const body = asRecord(root.data)
      report.bgpPrefix = asString(body.resource)
      report.relatedPrefixes = Array.isArray(body.related_prefixes)
        ? body.related_prefixes.map((p) => asString(p)).filter(Boolean)
        : []
      const asns = Array.isArray(body.asns) ? body.asns : []
      const primaryAsn = asRecord(asns[0])
      bgpAsn.asn = parseAsnNumber(primaryAsn.asn)
      bgpAsn.holder = asString(primaryAsn.holder)
    } catch {
      // Leave BGP empty on error
    } finally {
      report.bgpLoading = false
      emitUpdate()
    }
  })()

  const ptrTask = (async () => {
    try {
      report.ptr = await fetchPtrRecord(ip, options?.signal)
    } finally {
      report.ptrLoading = false
      emitUpdate()
    }
  })()

  await Promise.allSettled([...dbTasks, rirTask, bgpTask, ptrTask])
  recomputeSummary(report, metas, bgpAsn)
  return cloneReport(report)
}
