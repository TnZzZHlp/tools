import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/ui/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import {
  computeCSegmentCidr,
  countryCodeToFlag,
  inspectIpAddress,
  ipToNumericString,
  isPrivateOrReservedIp,
  normalizeQueryInput,
  parseIpVersion,
  redactIp,
  toReverseDnsName,
} from '@/lib/ip-check'
import IpCheckView from '@/views/IpCheckView.vue'

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

function textResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => JSON.parse(body),
    text: async () => body,
  }
}

describe('ip-utils', () => {
  it('validates IPv4/IPv6 addresses and normalizes URLs, ports, and domains', () => {
    expect(parseIpVersion('1.1.1.1')).toBe(4)
    expect(parseIpVersion('256.1.1.1')).toBeNull()
    expect(parseIpVersion('01.1.1.1')).toBeNull()
    expect(parseIpVersion('2606:4700:4700::1111')).toBe(6)
    expect(parseIpVersion('::ffff:192.0.2.128')).toBe(6)

    expect(normalizeQueryInput(' 8.8.8.8:53 ')).toEqual({
      kind: 'ip',
      value: '8.8.8.8',
      ipVersion: 4,
    })
    expect(normalizeQueryInput('[2606:4700::1111]:443')).toEqual({
      kind: 'ip',
      value: '2606:4700::1111',
      ipVersion: 6,
    })
    expect(normalizeQueryInput('https://Cloudflare.com/cdn-cgi/trace')).toEqual({
      kind: 'domain',
      value: 'cloudflare.com',
    })
    expect(normalizeQueryInput('not a valid query!')).toEqual({
      kind: 'invalid',
      value: 'not a valid query!',
    })
  })

  it('computes numeric IP, C-segment CIDR, PTR reverse name, privacy redaction, and flags', () => {
    expect(ipToNumericString('1.1.1.1')).toBe('16843009')
    expect(ipToNumericString('2001:4860:4860::8888')).toBe('42541956123769884636017138956568135816')

    expect(computeCSegmentCidr('69.63.193.86')).toBe('69.63.193.0/24')
    expect(computeCSegmentCidr('2606:4700:4700::1111')).toBe('2606:4700:4700::/48')

    expect(toReverseDnsName('8.8.4.4')).toBe('4.4.8.8.in-addr.arpa')
    expect(toReverseDnsName('2606:4700:4700::1111')).toBe(
      '1.1.1.1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.7.4.0.0.7.4.6.0.6.2.ip6.arpa',
    )

    expect(isPrivateOrReservedIp('192.168.1.10')).toBe(true)
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true)
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false)

    expect(redactIp('69.63.193.86')).toBe('69.63.*.*')
    expect(redactIp('2605:52c0:1:123e::1')).toBe('2605:52c0:*:*')

    expect(countryCodeToFlag('US')).toBe('🇺🇸')
    expect(countryCodeToFlag('cn')).toBe('🇨🇳')
    expect(countryCodeToFlag('invalid')).toBe('')
  })
})

describe('inspectIpAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fast-paths private/reserved IP addresses without external requests', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const report = await inspectIpAddress('192.168.1.1')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(report.nativeStatus).toBe('bogon')
    expect(report.usageType).toBe('bogon')
    expect(report.riskScore).toBe(0)
    expect(report.cSegment).toBe('192.168.1.0/24')
  })

  it('identifies native datacenter IP and tolerates single provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('api.ipquery.io/')) {
          return jsonResponse({
            ip: '69.63.193.86',
            isp: { asn: 'AS906', org: 'DMIT Cloud Services', isp: 'DMIT Cloud Services' },
            location: {
              country: 'United States',
              country_code: 'US',
              city: 'Los Angeles',
              state: 'California',
              latitude: 34.07,
              longitude: -118.27,
              timezone: 'America/Los_Angeles',
            },
            risk: {
              is_mobile: false,
              is_vpn: false,
              is_tor: false,
              is_proxy: false,
              is_datacenter: true,
              risk_score: 5,
            },
          })
        }
        if (url.includes('ipwho.is/')) {
          return jsonResponse({}, 503)
        }
        if (url.includes('freeipapi.com')) {
          return jsonResponse({
            countryName: 'United States',
            countryCode: 'US',
            regionName: 'California',
            cityName: 'Los Angeles',
            asn: '906',
            asnOrganization: 'DMIT Cloud Services',
            isProxy: false,
          })
        }
        if (url.includes('get.geojs.io')) {
          return jsonResponse({
            country: 'United States',
            country_code: 'US',
            region: 'California',
            city: 'Los Angeles',
            asn: 906,
            organization_name: 'DMIT Cloud Services',
            timezone: 'America/Los_Angeles',
          })
        }
        if (url.includes('api.ipapi.is')) {
          return jsonResponse({
            country: 'United States',
            region: 'California',
            city: 'Los Angeles',
            asn: 'AS906 DMIT Cloud Services',
            company: 'Private Customer',
            is_bogon: false,
          })
        }
        if (url.includes('ip.zxinc.org')) {
          return jsonResponse({
            code: 0,
            data: { country: '美国–加利福尼亚州–洛杉矶', local: 'DMIT' },
          })
        }
        if (url.includes('stat.ripe.net/data/rir/')) {
          return jsonResponse({
            data: {
              rirs: [
                {
                  rir: 'ARIN',
                  country: 'US',
                  resource: '69.63.192.0/19',
                  registration: '2003-07-25T00:00:00',
                },
              ],
            },
          })
        }
        if (url.includes('stat.ripe.net/data/prefix-overview/')) {
          return jsonResponse({
            data: {
              resource: '69.63.193.0/24',
              related_prefixes: ['69.63.192.0/19'],
              asns: [{ asn: 906, holder: 'DMIT - DMIT Cloud Services' }],
            },
          })
        }
        if (url.includes('type=PTR')) {
          return jsonResponse({
            Status: 0,
            Answer: [{ type: 12, data: 'server.dmit.example.' }],
          })
        }
        return jsonResponse({}, 404)
      }),
    )

    const report = await inspectIpAddress('69.63.193.86')
    expect(report.countryCode).toBe('US')
    expect(report.rir).toBe('ARIN')
    expect(report.rirCountry).toBe('US')
    expect(report.nativeStatus).toBe('native')
    expect(report.usageType).toBe('datacenter')
    expect(report.riskScore).toBe(5)
    expect(report.bgpPrefix).toBe('69.63.193.0/24')
    expect(report.ptr).toBe('server.dmit.example')

    const ipwhoisRow = report.databases.find((db) => db.id === 'ipwhois')
    expect(ipwhoisRow?.status).toBe('error')
    expect(report.databases.filter((db) => db.status === 'ok')).toHaveLength(5)
  })

  it('detects broadcast IP when RIR country differs from GeoIP landing country', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('api.ipquery.io/')) {
          return jsonResponse({
            isp: { asn: 'AS13335', org: 'Cloudflare, Inc.', isp: 'Cloudflare, Inc.' },
            location: { country: 'Hong Kong', country_code: 'HK', city: 'Hong Kong' },
            risk: { is_datacenter: true, is_proxy: false, risk_score: 0 },
          })
        }
        if (url.includes('stat.ripe.net/data/rir/')) {
          return jsonResponse({
            data: { rirs: [{ rir: 'APNIC', country: 'AU', resource: '1.1.1.0/24' }] },
          })
        }
        if (url.includes('stat.ripe.net/data/prefix-overview/')) {
          return jsonResponse({ data: { resource: '1.1.1.0/24', asns: [] } })
        }
        return jsonResponse({}, 500)
      }),
    )

    const report = await inspectIpAddress('1.1.1.1')
    expect(report.countryCode).toBe('HK')
    expect(report.rirCountry).toBe('AU')
    expect(report.nativeStatus).toBe('broadcast')
  })
})

describe('IpCheckView component', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('probes local exits, compares multi-source databases, and queries arbitrary IP 8.8.8.8', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('myip.ipip.net/json')) {
          return jsonResponse({
            ret: 'ok',
            data: { ip: '123.90.2.15', location: ['中国', '广东', '广州', '', '移动'] },
          })
        }
        if (url.endsWith('api.ipquery.io/?format=json')) {
          return jsonResponse({
            ip: '69.63.193.86',
            isp: { asn: 'AS906', org: 'DMIT Cloud Services', isp: 'DMIT Cloud Services' },
            location: {
              country: 'United States',
              country_code: 'US',
              state: 'California',
              city: 'Los Angeles',
            },
          })
        }
        if (url.includes('api6.ipify.org') || url.includes('ipv6.icanhazip.com')) {
          return jsonResponse({}, 503)
        }
        if (url.includes('cdn-cgi/trace')) {
          return textResponse('ip=69.63.193.86\nloc=US\ncolo=LAX\nhttp=http/2\ntls=TLSv1.3\n')
        }
        if (url.includes('api.ipquery.io/8.8.8.8')) {
          return jsonResponse({
            ip: '8.8.8.8',
            isp: { asn: 'AS15169', org: 'Google LLC', isp: 'Google LLC' },
            location: {
              country: 'United States',
              country_code: 'US',
              state: 'California',
              city: 'Mountain View',
              timezone: 'America/Los_Angeles',
            },
            risk: {
              is_datacenter: true,
              is_proxy: false,
              is_vpn: false,
              is_tor: false,
              is_mobile: false,
              risk_score: 0,
            },
          })
        }
        if (url.includes('api.ipquery.io/69.63.193.86')) {
          return jsonResponse({
            ip: '69.63.193.86',
            isp: { asn: 'AS906', org: 'DMIT Cloud Services', isp: 'DMIT Cloud Services' },
            location: { country: 'United States', country_code: 'US', city: 'Los Angeles' },
            risk: { is_datacenter: true, risk_score: 0 },
          })
        }
        if (url.includes('ipwho.is/')) {
          return jsonResponse({
            success: true,
            country: 'United States',
            country_code: 'US',
            region: 'California',
            city: url.includes('8.8.8.8') ? 'Mountain View' : 'Los Angeles',
            connection: { asn: url.includes('8.8.8.8') ? 15169 : 906, isp: 'Mock ISP' },
            timezone: { id: 'America/Los_Angeles' },
          })
        }
        if (url.includes('freeipapi.com')) {
          return jsonResponse({
            countryName: 'United States',
            countryCode: 'US',
            regionName: 'California',
            cityName: 'Mountain View',
            asn: '15169',
            asnOrganization: 'Google LLC',
            isProxy: false,
          })
        }
        if (url.includes('get.geojs.io')) {
          return jsonResponse({
            country: 'United States',
            country_code: 'US',
            region: 'California',
            city: 'Mountain View',
            asn: 15169,
            organization_name: 'Google LLC',
            timezone: 'America/Los_Angeles',
          })
        }
        if (url.includes('api.ipapi.is')) {
          return jsonResponse({
            country: 'United States',
            region: 'California',
            city: 'Mountain View',
            asn: 'AS15169 Google LLC',
            company: 'Google LLC',
            is_bogon: false,
          })
        }
        if (url.includes('ip.zxinc.org')) {
          return jsonResponse({
            code: 0,
            data: { country: '美国–加利福尼亚州', local: 'Google' },
          })
        }
        if (url.includes('stat.ripe.net/data/rir/')) {
          return jsonResponse({
            data: { rirs: [{ rir: 'ARIN', country: 'US', resource: '8.8.8.0/24' }] },
          })
        }
        if (url.includes('stat.ripe.net/data/prefix-overview/')) {
          return jsonResponse({
            data: { resource: '8.8.8.0/24', asns: [{ asn: 15169, holder: 'GOOGLE' }] },
          })
        }
        if (url.includes('type=PTR')) {
          return jsonResponse({
            Status: 0,
            Answer: [{ type: 12, data: 'dns.google.' }],
          })
        }
        return jsonResponse({}, 404)
      }),
    )

    const Harness = defineComponent({
      setup() {
        return () =>
          h(ThemeProvider, null, {
            default: () =>
              h(ToastProvider, null, {
                default: () => h(IpCheckView),
              }),
          })
      },
    })

    const wrapper = mount(Harness)
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('IP 归属与质量检测')
    expect(wrapper.text()).toContain('123.90.2.15')
    expect(wrapper.text()).toContain('69.63.193.86')
    expect(wrapper.text()).toContain('国内外分流已生效')
    expect(wrapper.text()).toContain('IPQuery')
    expect(wrapper.text()).toContain('ZXINC 中文库')

    // Submit custom IP lookup
    await wrapper.get('input[aria-label="查询 IP 地址或域名"]').setValue('8.8.8.8')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('8.8.8.8')
    expect(wrapper.text()).toContain('8.8.8.0/24')
    expect(wrapper.text()).toContain('dns.google')
    expect(wrapper.text()).toContain('原生 IP (US)')
    expect(wrapper.text()).toContain('AS15169')
  })
})
