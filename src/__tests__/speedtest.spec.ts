import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/components/ui/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import {
  BUILTIN_TARGETS,
  MAX_DURATION,
  MIN_DURATION,
  SAMPLE_INTERVAL,
  appendQueryParam,
  estimate,
  formatBandwidth,
  formatGeoLocation,
  formatGeoProvider,
  formatJitter,
  formatLatency,
  formatTraffic,
  meanAbsoluteDelta,
  median,
  pickOptimalTarget,
  probeTargets,
  rankOptimalTargets,
  scoreTarget,
  shouldStop,
  smoothed,
  sustained,
  validateCustomTargetDraft,
} from '@/lib/speedtest'
import SpeedtestView from '@/views/SpeedtestView.vue'

describe('speedtest stability rules', () => {
  it('computes trimmed sustained & smoothed rates after warmup', () => {
    const warmupSamples = Array.from({ length: 15 }, () => 20)
    const steadySamples = Array.from({ length: 50 }, (_, idx) =>
      idx === 10 ? 2 : idx === 20 ? 500 : 100,
    )
    const all = [...warmupSamples, ...steadySamples]

    expect(sustained(warmupSamples)).toBe(0)
    expect(sustained(all)).toBeCloseTo(100, 1)
    expect(smoothed(all)).toBeCloseTo(100, 1)
    expect(estimate(all)).toBeCloseTo(100, 1)
  })

  it('enforces MIN_DURATION, early stability stop, and MAX_DURATION cap', () => {
    const minCount = Math.round(MIN_DURATION / SAMPLE_INTERVAL)
    const maxCount = Math.round(MAX_DURATION / SAMPLE_INTERVAL)

    // Steady but shorter than MIN_DURATION -> keep running
    expect(shouldStop(Array.from({ length: minCount - 1 }, () => 150))).toBe(false)

    // Steady at MIN_DURATION -> stop early
    expect(shouldStop(Array.from({ length: minCount }, () => 150))).toBe(true)

    // Unstable at MIN_DURATION -> keep running
    const unstable = Array.from({ length: minCount }, (_, i) => 100 + (i % 2 === 0 ? -15 : 15))
    expect(shouldStop(unstable)).toBe(false)

    // Reaches MAX_DURATION -> always stop
    const maxUnstable = Array.from({ length: maxCount }, (_, i) => 50 + i * 2)
    expect(shouldStop(maxUnstable)).toBe(true)
  })
})

describe('speedtest formatting & engine helpers', () => {
  it('formats bandwidth, traffic, latency, and jitter accurately', () => {
    expect(formatBandwidth(null)).toBeNull()
    expect(formatBandwidth(0.5)).toEqual({ value: '500.0', unit: 'Kbps' })
    expect(formatBandwidth(245.678)).toEqual({ value: '245.68', unit: 'Mbps' })
    expect(formatBandwidth(1250)).toEqual({ value: '1.25', unit: 'Gbps' })

    expect(formatTraffic(0)).toEqual({ value: '0', unit: 'B' })
    expect(formatTraffic(512)).toEqual({ value: '512', unit: 'B' })
    expect(formatTraffic(150 * 1024 * 1024)).toEqual({ value: '150', unit: 'MiB' })
    expect(formatTraffic(1.5 * 1024 * 1024 * 1024)).toEqual({ value: '1.50', unit: 'GiB' })

    expect(formatLatency(null)).toBeNull()
    expect(formatLatency(4.32)).toBe('4.3')
    expect(formatLatency(9.96)).toBe('10')
    expect(formatLatency(32.4)).toBe('32')
    expect(formatJitter(1.84)).toBe('1.8')
  })

  it('appends query params safely and computes median & jitter', () => {
    expect(appendQueryParam('https://speed.cloudflare.com/__down?bytes=0', 'ping', '1.2')).toBe(
      'https://speed.cloudflare.com/__down?bytes=0&ping=1.2',
    )
    expect(appendQueryParam('https://example.com/probe', 'ping', '1.2')).toBe(
      'https://example.com/probe?ping=1.2',
    )

    expect(median([10, 30, 20])).toBe(20)
    expect(median([10, 20, 30, 40])).toBe(25)
    expect(meanAbsoluteDelta([10, 14, 11])).toBeCloseTo(3.5, 5)
  })

  it('validates custom speedtest targets and formats geo details', () => {
    expect(BUILTIN_TARGETS[0]?.id).toBe('cloudflare-edge')
    expect(BUILTIN_TARGETS[0]?.download[0]).toContain('speed.cloudflare.com')

    const invalid = validateCustomTargetDraft({
      name: '',
      ping: 'not-a-url',
      downloadText: '',
      uploadText: '',
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.name).toBeTruthy()
    expect(invalid.errors.downloadText).toBeTruthy()
    expect(invalid.errors.ping).toBeTruthy()

    const valid = validateCustomTargetDraft({
      name: 'HK Edge',
      ping: '',
      downloadText: 'https://cdn1.example.com/100m.bin, https://cdn2.example.com/100m.bin',
      uploadText: '',
    })
    expect(valid.valid).toBe(true)
    expect(valid.target?.ping).toBe('https://cdn1.example.com/100m.bin')
    expect(valid.target?.download).toHaveLength(2)
    expect(valid.target?.upload).toEqual([])

    const sampleGeo = {
      ip: '2001:db8::1',
      country: 'Japan',
      country_code: 'JP',
      region: 'Tokyo',
      city: 'Tokyo',
      timezone: 'Asia/Tokyo',
      isp: 'SoftBank',
      organization: 'SoftBank',
      asn: 17676,
    }
    expect(formatGeoLocation(sampleGeo, false)).toBe('Tokyo, Japan')
    expect(formatGeoLocation(sampleGeo, true)).toBe('Japan')
    expect(formatGeoProvider(sampleGeo)).toBe('AS17676 SoftBank')
  })

  it('includes domestic and global builtin targets with valid HTTPS URLs', () => {
    const domestic = BUILTIN_TARGETS.filter((t) => t.region === 'domestic')
    const global = BUILTIN_TARGETS.filter((t) => t.region === 'global')

    expect(domestic.length).toBeGreaterThanOrEqual(4)
    expect(global.length).toBeGreaterThanOrEqual(4)

    for (const target of BUILTIN_TARGETS) {
      expect(target.ping.startsWith('https://')).toBe(true)
      expect(target.ping).not.toContain('123pan.com')
      expect(target.download.length).toBeGreaterThan(0)
      for (const url of target.download) {
        expect(url.startsWith('https://')).toBe(true)
        expect(url).not.toContain('123pan.com')
      }
    }
  })

  it('scores targets and picks optimal node across domestic and overseas networks', () => {
    const cfEdge = BUILTIN_TARGETS.find((t) => t.id === 'cloudflare-edge')!
    const cfLight = BUILTIN_TARGETS.find((t) => t.id === 'cloudflare-light')!
    const cachefly = BUILTIN_TARGETS.find((t) => t.id === 'cachefly-global')!
    const cnMulti = BUILTIN_TARGETS.find((t) => t.id === 'cn-multi')!

    expect(scoreTarget(cfLight, 1)).toBe(Number.POSITIVE_INFINITY)

    // Mainland China visitor: low domestic RTT beats high overseas RTT
    const cnPick = pickOptimalTarget(
      BUILTIN_TARGETS,
      {
        'cn-multi': 22,
        'cn-tencent': 20,
        'cloudflare-edge': 165,
        'sharktech-us-west': 180,
      },
      'CN',
    )
    expect(cnPick.id).toBe('cn-multi')

    // Overseas visitor: full-duplex Cloudflare (10ms) beats download-only CacheFly (8ms)
    expect(scoreTarget(cfEdge, 10, 'SG')).toBeLessThan(scoreTarget(cachefly, 8, 'SG'))
    const sgPick = pickOptimalTarget(
      BUILTIN_TARGETS,
      {
        'cloudflare-edge': 10,
        'cachefly-global': 8,
        'cn-multi': 120,
      },
      'SG',
    )
    expect(sgPick.id).toBe('cloudflare-edge')

    // Fallback before any probes land
    expect(pickOptimalTarget(BUILTIN_TARGETS, {}, 'CN').id).toBe(cnMulti.id)
    expect(pickOptimalTarget(BUILTIN_TARGETS, {}, 'SG').id).toBe(cfEdge.id)

    // Ranking & automatic advancement when primary candidates are excluded
    const latencies = {
      'cn-multi': 18,
      'cn-tencent': 22,
      'cn-aliyun': 26,
      'cloudflare-edge': 160,
    }
    expect(
      rankOptimalTargets(BUILTIN_TARGETS, latencies, 'CN')
        .map((t) => t.id)
        .slice(0, 3),
    ).toEqual(['cn-multi', 'cn-tencent', 'cn-aliyun'])
    const excluded = new Set(['cn-multi'])
    expect(pickOptimalTarget(BUILTIN_TARGETS, latencies, 'CN', excluded).id).toBe('cn-tencent')
    excluded.add('cn-tencent')
    expect(pickOptimalTarget(BUILTIN_TARGETS, latencies, 'CN', excluded).id).toBe('cn-aliyun')
  })

  it('deduplicates shared ping URLs during probeTargets and handles failures', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('fail.example.com')) {
        return { ok: false, status: 503, body: null }
      }
      return { ok: true, status: 200, body: null }
    })
    vi.stubGlobal('fetch', mockFetch)

    try {
      const subset = BUILTIN_TARGETS.filter(
        (t) => t.id === 'cloudflare-edge' || t.id === 'cloudflare-light' || t.id === 'cn-tencent',
      )
      const withFail = [
        ...subset,
        {
          id: 'broken',
          name: 'Broken',
          ping: 'https://fail.example.com/ping',
          download: ['https://fail.example.com/dl'],
          upload: [],
        },
      ]
      const seen = new Set<string>()
      const res = await probeTargets(withFail, {
        onResult: (id) => seen.add(id),
      })

      // cloudflare-edge + cloudflare-light share 1 ping URL -> 3 unique URLs probed (1 warmup + 2 samples each = 9 max, broken fails on warmup = 1 call -> 7 calls total)
      expect(mockFetch).toHaveBeenCalledTimes(7)
      expect(typeof res['cloudflare-edge']).toBe('number')
      expect(res['cloudflare-light']).toBe(res['cloudflare-edge'])
      expect(typeof res['cn-tencent']).toBe('number')
      expect(res.broken).toBeNull()
      expect(seen.size).toBe(4)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('SpeedtestView component', () => {
  it('renders P0seid0n speedtest controls, panels, and privacy toggle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('ip.sb')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ip: '198.51.100.42',
              country: 'Singapore',
              country_code: 'SG',
              region: 'Singapore',
              city: 'Singapore',
              timezone: 'Asia/Singapore',
              isp: 'Cloudflare, Inc.',
              asn: 13335,
            }),
          }
        }
        const ok = url.includes('speed.cloudflare.com')
        return {
          ok,
          status: ok ? 200 : 503,
          body: null,
        }
      }),
    )

    const Harness = defineComponent({
      setup() {
        return () =>
          h(ThemeProvider, null, {
            default: () =>
              h(ToastProvider, null, {
                default: () => h(SpeedtestView),
              }),
          })
      },
    })

    const wrapper = mount(Harness)
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('198.51.100.42')
      expect(wrapper.text()).toContain('自动优选 · Cloudflare 全球边缘')
    })

    expect(wrapper.text()).toContain('网络测速')
    expect(wrapper.text()).toContain('开始测速')
    expect(wrapper.text()).toContain('多线程')
    expect(wrapper.text()).toContain('单线程')
    expect(wrapper.text()).toContain('下载')
    expect(wrapper.text()).toContain('上传')
    expect(wrapper.text()).toContain('Cloudflare 全球边缘')

    // Toggle privacy redaction
    const hideBtn = wrapper.findAll('button').find((btn) => btn.text().includes('隐藏详情'))
    expect(hideBtn).toBeTruthy()
    await hideBtn!.trigger('click')
    expect(wrapper.text()).toContain('已隐藏')
    expect(wrapper.text()).not.toContain('198.51.100.42')

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('automatically fails over to the next optimal node when the top candidate fails during test', async () => {
    let failCloudflare = false

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('ip.sb')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ip: '198.51.100.42',
              country: 'Singapore',
              country_code: 'SG',
              region: 'Singapore',
              city: 'Singapore',
              timezone: 'Asia/Singapore',
              isp: 'Cloudflare, Inc.',
              asn: 13335,
            }),
          }
        }
        if (url.includes('speed.cloudflare.com')) {
          return {
            ok: !failCloudflare,
            status: failCloudflare ? 403 : 200,
            body: null,
          }
        }
        if (url.includes('laxspeed.sharktech.net')) {
          await new Promise((resolve) => setTimeout(resolve, 25))
          return {
            ok: true,
            status: 200,
            body: null,
          }
        }
        return {
          ok: false,
          status: 503,
          body: null,
        }
      }),
    )

    const Harness = defineComponent({
      setup() {
        return () =>
          h(ThemeProvider, null, {
            default: () =>
              h(ToastProvider, null, {
                default: () => h(SpeedtestView),
              }),
          })
      },
    })

    const wrapper = mount(Harness)
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('自动优选 · Cloudflare 全球边缘')
    })

    failCloudflare = true
    const startBtn = wrapper.findAll('button').find((btn) => btn.text().includes('开始测速'))
    expect(startBtn).toBeTruthy()
    await startBtn!.trigger('click')

    await vi.waitFor(
      () => {
        expect(wrapper.text()).toContain('Sharktech 美西 · 洛杉矶')
      },
      { timeout: 3000 },
    )
    expect(wrapper.text()).not.toContain('测速中断')

    const stopBtn = wrapper.findAll('button').find((btn) => btn.text().includes('停止测速'))
    await stopBtn?.trigger('click')
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
