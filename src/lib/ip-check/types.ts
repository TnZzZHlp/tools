export type ExitSlotId = 'domestic' | 'global-v4' | 'ipv6' | 'cloudflare'

export type ExitSlotStatus = 'loading' | 'ok' | 'unavailable'

export interface ExitEndpointResult {
  id: ExitSlotId
  label: string
  subtitle: string
  status: ExitSlotStatus
  ip: string
  ipVersion: 4 | 6 | null
  location: string
  countryCode: string
  isp: string
  extra: string
  latencyMs: number | null
  error?: string
}

export type GeoDatabaseId = 'ipquery' | 'ipwhois' | 'freeipapi' | 'geojs' | 'ipapi_is' | 'zxinc'

export type GeoDatabaseStatus = 'loading' | 'ok' | 'error'

export interface GeoDatabaseRecord {
  id: GeoDatabaseId
  sourceName: string
  status: GeoDatabaseStatus
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  asn: string
  coordinates: string
  timezone: string
  latencyMs: number | null
  error?: string
}

export type NativeIpStatus = 'native' | 'broadcast' | 'bogon' | 'unknown'

export type IpUsageType = 'datacenter' | 'residential' | 'mobile' | 'bogon' | 'unknown'

export interface IpRiskFlags {
  isDatacenter: boolean | null
  isProxy: boolean | null
  isVpn: boolean | null
  isTor: boolean | null
  isMobile: boolean | null
  isBogon: boolean | null
}

export interface IpInspectionReport {
  ip: string
  ipVersion: 4 | 6
  numericIp: string
  cSegment: string
  ptr: string | null
  ptrLoading: boolean
  country: string
  countryCode: string
  region: string
  city: string
  timezone: string
  coordinates: string
  asn: number | null
  asnOrg: string
  isp: string
  bgpPrefix: string
  relatedPrefixes: string[]
  rir: string
  rirCountry: string
  allocatedPrefix: string
  allocationDate: string
  nativeStatus: NativeIpStatus
  usageType: IpUsageType
  riskScore: number | null
  flags: IpRiskFlags
  databases: GeoDatabaseRecord[]
  bgpLoading: boolean
  rirLoading: boolean
}

export interface WebRtcProbeResult {
  status: 'idle' | 'running' | 'done' | 'unsupported'
  publicIps: string[]
  localIps: string[]
  error?: string
}
