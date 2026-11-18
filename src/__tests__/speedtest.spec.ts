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
})

describe('SpeedtestView component', () => {
  it('renders P0seid0n speedtest controls, panels, and privacy toggle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
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

    vi.unstubAllGlobals()
  })
})
