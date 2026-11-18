export interface GeoInfo {
  ip: string
  country: string
  country_code: string
  region: string
  city: string
  timezone: string
  isp: string
  organization: string
  asn: number | null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

async function fetchFromIpSb(signal?: AbortSignal): Promise<GeoInfo> {
  const response = await fetch('https://api.ip.sb/geoip', {
    cache: 'no-store',
    credentials: 'omit',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
      : AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error(`ip.sb status ${response.status}`)
  const data = (await response.json()) as Record<string, unknown>
  const ip = asString(data.ip)
  if (!ip) throw new Error('ip.sb missing ip')

  return {
    ip,
    country: asString(data.country),
    country_code: asString(data.country_code),
    region: asString(data.region),
    city: asString(data.city),
    timezone: asString(data.timezone),
    isp: asString(data.isp) || asString(data.asn_organization) || asString(data.organization),
    organization: asString(data.organization) || asString(data.asn_organization),
    asn: asNumber(data.asn),
  }
}

async function fetchFromIpWhoIs(signal?: AbortSignal): Promise<GeoInfo> {
  const response = await fetch('https://ipwho.is/', {
    cache: 'no-store',
    credentials: 'omit',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
      : AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error(`ipwho.is status ${response.status}`)
  const data = (await response.json()) as Record<string, unknown>
  if (data.success === false) throw new Error('ipwho.is lookup unsuccessful')
  const ip = asString(data.ip)
  if (!ip) throw new Error('ipwho.is missing ip')

  const connection =
    typeof data.connection === 'object' && data.connection !== null
      ? (data.connection as Record<string, unknown>)
      : {}
  const timezone =
    typeof data.timezone === 'object' && data.timezone !== null
      ? (data.timezone as Record<string, unknown>)
      : {}

  return {
    ip,
    country: asString(data.country),
    country_code: asString(data.country_code),
    region: asString(data.region),
    city: asString(data.city),
    timezone: asString(timezone.id),
    isp: asString(connection.isp) || asString(connection.org),
    organization: asString(connection.org),
    asn: asNumber(connection.asn),
  }
}

async function fetchFromCloudflareHeaders(signal?: AbortSignal): Promise<GeoInfo> {
  const response = await fetch('https://speed.cloudflare.com/__down?bytes=0', {
    method: 'HEAD',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
      : AbortSignal.timeout(6000),
  })
  if (!response.ok) throw new Error(`cf head status ${response.status}`)
  const ip = asString(response.headers.get('cf-meta-ip'))
  if (!ip) throw new Error('cf headers missing ip')

  const asn = asNumber(response.headers.get('cf-meta-asn'))
  const colo = asString(response.headers.get('cf-meta-colo'))

  return {
    ip,
    country: asString(response.headers.get('cf-meta-country')),
    country_code: asString(response.headers.get('cf-meta-country')),
    region: '',
    city: asString(response.headers.get('cf-meta-city')),
    timezone: asString(response.headers.get('cf-meta-timezone')),
    isp: asn ? `AS${asn}${colo ? ` · ${colo}` : ''}` : colo,
    organization: '',
    asn,
  }
}

/** Resolves client IP, location, and ISP using CORS-enabled geo endpoints with automatic fallback. */
export async function fetchGeoInfo(signal?: AbortSignal): Promise<GeoInfo> {
  const providers = [fetchFromIpSb, fetchFromIpWhoIs, fetchFromCloudflareHeaders]
  let lastError: unknown
  for (const provider of providers) {
    if (signal?.aborted) throw signal.reason
    try {
      return await provider(signal)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch IP geolocation')
}

export function formatGeoLocation(geo: GeoInfo | null, redacted: boolean): string {
  if (!geo) return ''
  if (redacted) return geo.country || geo.country_code || ''
  const parts: string[] = []
  for (const raw of [geo.city, geo.region, geo.country]) {
    const trimmed = raw.trim()
    if (trimmed && !parts.includes(trimmed)) {
      parts.push(trimmed)
    }
  }
  return parts.join(', ')
}

export function formatGeoProvider(geo: GeoInfo | null): string {
  if (!geo) return ''
  const name = geo.isp || geo.organization
  if (name && geo.asn && !name.includes(`AS${geo.asn}`)) {
    return `AS${geo.asn} ${name}`
  }
  if (name) return name
  if (geo.asn) return `AS${geo.asn}`
  return ''
}
