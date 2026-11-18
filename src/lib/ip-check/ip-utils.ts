const RE_DIGITS_ONLY = /^\d+$/
const RE_HEX_GROUP = /^[0-9a-fA-F]{1,4}$/
const RE_SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//
const RE_IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/
const RE_BRACKETED_IPV6 = /^\[([^\]]+)\](?::(\d{1,5}))?$/
const RE_HOST_WITH_PORT = /^([^:]+):(\d{1,5})$/
const RE_DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function parseIpv4Octets(input: string): [number, number, number, number] | null {
  const parts = input.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!RE_DIGITS_ONLY.test(part)) return null
    if (part.length > 1 && part.startsWith('0')) return null
    const num = Number(part)
    if (!Number.isInteger(num) || num < 0 || num > 255) return null
    octets.push(num)
  }
  const [o0, o1, o2, o3] = octets
  if (o0 === undefined || o1 === undefined || o2 === undefined || o3 === undefined) {
    return null
  }
  return [o0, o1, o2, o3]
}

export function expandIpv6(input: string): string[] | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const zoneIdx = trimmed.indexOf('%')
  const raw = zoneIdx >= 0 ? trimmed.slice(0, zoneIdx) : trimmed
  if (!raw.includes(':')) return null

  const doubleColonParts = raw.split('::')
  if (doubleColonParts.length > 2) return null

  const expandPart = (segment: string): string[] | null => {
    if (!segment) return []
    const tokens = segment.split(':')
    const result: string[] = []
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]
      if (token === undefined) return null
      if (token.includes('.')) {
        if (i !== tokens.length - 1) return null
        const octets = parseIpv4Octets(token)
        if (!octets) return null
        const hi = ((octets[0] << 8) | octets[1]).toString(16).padStart(4, '0')
        const lo = ((octets[2] << 8) | octets[3]).toString(16).padStart(4, '0')
        result.push(hi, lo)
      } else {
        if (!RE_HEX_GROUP.test(token)) return null
        result.push(token.toLowerCase().padStart(4, '0'))
      }
    }
    return result
  }

  const headRaw = doubleColonParts[0] ?? ''
  const tailRaw = doubleColonParts[1]
  const head = expandPart(headRaw)
  if (!head) return null

  if (tailRaw === undefined) {
    return head.length === 8 ? head : null
  }

  const tail = expandPart(tailRaw)
  if (!tail) return null
  const missing = 8 - (head.length + tail.length)
  if (missing < 1) return null
  const zeros = Array.from({ length: missing }, () => '0000')
  return [...head, ...zeros, ...tail]
}

export function parseIpVersion(input: string): 4 | 6 | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (parseIpv4Octets(trimmed)) return 4
  if (expandIpv6(trimmed)) return 6
  return null
}

export function isValidDomain(input: string): boolean {
  const clean = input.trim().replace(/\.$/, '').toLowerCase()
  if (!clean || clean.length > 253) return false
  const labels = clean.split('.')
  if (labels.length < 2) return false
  for (const label of labels) {
    if (!RE_DOMAIN_LABEL.test(label)) return false
  }
  const tld = labels[labels.length - 1] ?? ''
  return !RE_DIGITS_ONLY.test(tld)
}

export type NormalizedQuery =
  | { kind: 'empty'; value: '' }
  | { kind: 'ip'; value: string; ipVersion: 4 | 6 }
  | { kind: 'domain'; value: string }
  | { kind: 'invalid'; value: string }

export function normalizeQueryInput(raw: string): NormalizedQuery {
  let candidate = raw.trim()
  if (!candidate) return { kind: 'empty', value: '' }

  // Bracketed IPv6 e.g. [2606:4700::1111]:443
  const bracketMatch = RE_BRACKETED_IPV6.exec(candidate)
  if (bracketMatch?.[1] && expandIpv6(bracketMatch[1])) {
    return { kind: 'ip', value: bracketMatch[1], ipVersion: 6 }
  }

  // Raw IPv4 or IPv6 before URL stripping
  const directVersion = parseIpVersion(candidate)
  if (directVersion) {
    return { kind: 'ip', value: candidate, ipVersion: directVersion }
  }

  // Strip URL scheme and path/query/hash
  if (RE_SCHEME_PREFIX.test(candidate)) {
    candidate = candidate.replace(RE_SCHEME_PREFIX, '')
  }
  const slashIdx = candidate.search(/[/?#]/)
  if (slashIdx >= 0) {
    candidate = candidate.slice(0, slashIdx)
  }
  candidate = candidate.trim()

  const bracketedHost = RE_BRACKETED_IPV6.exec(candidate)
  if (bracketedHost?.[1] && expandIpv6(bracketedHost[1])) {
    return { kind: 'ip', value: bracketedHost[1], ipVersion: 6 }
  }

  const ipv4Port = RE_IPV4_WITH_PORT.exec(candidate)
  if (ipv4Port?.[1] && parseIpv4Octets(ipv4Port[1])) {
    return { kind: 'ip', value: ipv4Port[1], ipVersion: 4 }
  }

  const hostPort = RE_HOST_WITH_PORT.exec(candidate)
  if (hostPort?.[1]) {
    candidate = hostPort[1]
  }

  const postVersion = parseIpVersion(candidate)
  if (postVersion) {
    return { kind: 'ip', value: candidate, ipVersion: postVersion }
  }

  const domain = candidate.replace(/\.$/, '').toLowerCase()
  if (isValidDomain(domain)) {
    return { kind: 'domain', value: domain }
  }

  return { kind: 'invalid', value: raw.trim() }
}

export function ipToNumericString(ip: string): string {
  const octets = parseIpv4Octets(ip.trim())
  if (octets) {
    const val =
      (BigInt(octets[0]) << 24n) |
      (BigInt(octets[1]) << 16n) |
      (BigInt(octets[2]) << 8n) |
      BigInt(octets[3])
    return val.toString(10)
  }
  const groups = expandIpv6(ip)
  if (groups) {
    let val = 0n
    for (const group of groups) {
      val = (val << 16n) | BigInt(Number.parseInt(group, 16))
    }
    return val.toString(10)
  }
  return ''
}

export function computeCSegmentCidr(ip: string): string {
  const octets = parseIpv4Octets(ip.trim())
  if (octets) {
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
  }
  const groups = expandIpv6(ip)
  if (groups) {
    const g0 = (groups[0] ?? '0000').replace(/^0+/, '') || '0'
    const g1 = (groups[1] ?? '0000').replace(/^0+/, '') || '0'
    const g2 = (groups[2] ?? '0000').replace(/^0+/, '') || '0'
    if (g0 === '0' && g1 === '0' && g2 === '0') {
      return '::/48'
    }
    return `${g0}:${g1}:${g2}::/48`
  }
  return ''
}

export function toReverseDnsName(ip: string): string | null {
  const octets = parseIpv4Octets(ip.trim())
  if (octets) {
    return `${octets[3]}.${octets[2]}.${octets[1]}.${octets[0]}.in-addr.arpa`
  }
  const groups = expandIpv6(ip)
  if (groups) {
    const nibbles = groups.join('').split('').reverse().join('.')
    return `${nibbles}.ip6.arpa`
  }
  return null
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const octets = parseIpv4Octets(ip.trim())
  if (octets) {
    const [o0, o1] = octets
    if (o0 === 0 || o0 === 10 || o0 === 127) return true
    if (o0 === 169 && o1 === 254) return true
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true
    if (o0 === 192 && o1 === 168) return true
    if (o0 === 100 && o1 >= 64 && o1 <= 127) return true
    if (o0 >= 224) return true
    return false
  }
  const groups = expandIpv6(ip)
  if (groups) {
    const joined = groups.join('')
    if (joined === '0'.repeat(32) || joined === `${'0'.repeat(31)}1`) return true
    const firstWord = Number.parseInt(groups[0] ?? '0', 16)
    // fc00::/7 (Unique Local)
    if ((firstWord & 0xfe00) === 0xfc00) return true
    // fe80::/10 (Link Local)
    if ((firstWord & 0xffc0) === 0xfe80) return true
    // ff00::/8 (Multicast)
    if ((firstWord & 0xff00) === 0xff00) return true
  }
  return false
}

export function redactIp(ip: string): string {
  const octets = parseIpv4Octets(ip.trim())
  if (octets) {
    return `${octets[0]}.${octets[1]}.*.*`
  }
  const groups = expandIpv6(ip)
  if (groups) {
    const g0 = (groups[0] ?? '0').replace(/^0+/, '') || '0'
    const g1 = (groups[1] ?? '0').replace(/^0+/, '') || '0'
    return `${g0}:${g1}:*:*`
  }
  return '***'
}

export function countryCodeToFlag(code: string): string {
  const clean = code.trim().toUpperCase()
  if (clean.length !== 2) return ''
  const c0 = clean.codePointAt(0)
  const c1 = clean.codePointAt(1)
  if (c0 === undefined || c1 === undefined) return ''
  if (c0 < 65 || c0 > 90 || c1 < 65 || c1 > 90) return ''
  const base = 0x1f1e6 - 65
  return String.fromCodePoint(base + c0, base + c1)
}
