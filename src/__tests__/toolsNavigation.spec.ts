import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import HomeView from '@/views/HomeView.vue'
import RandomStringView from '@/views/RandomStringView.vue'
import { recordRecentTool, resolveRouteBreadcrumbs, TOOLS, useRecentTools } from '@/lib/tools'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      ...TOOLS.map((tool) => ({
        path: tool.to,
        component: { template: '<div />' },
      })),
    ],
  })
}

describe('Tools registry & HomeView UX', () => {
  it('links PDF merge directly without intermediate hop and hides unlisted routes', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(HomeView, {
      global: { plugins: [router] },
    })

    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'))
    expect(hrefs).toContain('/tools/speedtest')
    expect(hrefs).toContain('/tools/ip-check')
    expect(hrefs).toContain('/tools/files/pdf-merge')
    expect(hrefs).not.toContain('/tools/exam-paper')
    expect(hrefs).not.toContain('/tools/ocr')
    expect(hrefs).not.toContain('/tools/files')
    expect(hrefs).not.toContain('/novels')
    expect(hrefs).not.toContain('/randomyuri')
  })

  it('filters tools by search query and category', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(HomeView, {
      global: { plugins: [router] },
    })

    const searchInput = wrapper.get('input[type="search"]')
    await searchInput.setValue('logql')
    expect(wrapper.text()).toContain('Rust tracing → LogQL')
    expect(wrapper.text()).not.toContain('吉他简谱记忆训练')
  })

  it('resolves breadcrumbs and tracks recent tools', () => {
    expect(resolveRouteBreadcrumbs('/')).toEqual([])
    expect(resolveRouteBreadcrumbs('/tools/speedtest')).toEqual([
      { label: '首页', to: '/' },
      { label: '网络与测速' },
      { label: '网络测速' },
    ])
    expect(resolveRouteBreadcrumbs('/tools/ip-check')).toEqual([
      { label: '首页', to: '/' },
      { label: '网络与测速' },
      { label: 'IP 检测' },
    ])
    expect(resolveRouteBreadcrumbs('/tools/files/pdf-merge')).toEqual([
      { label: '首页', to: '/' },
      { label: '文档与图像' },
      { label: 'PDF 合并' },
    ])
    expect(resolveRouteBreadcrumbs('/tools/exam-paper')).toEqual([
      { label: '首页', to: '/' },
      { label: '试卷模板' },
    ])

    recordRecentTool('/tools/encoding')
    recordRecentTool('/random-string')
    const { recentIds } = useRecentTools()
    expect(recentIds.value[0]).toBe('random-string')
    expect(recentIds.value[1]).toBe('encoding')
  })
})

describe('RandomStringView UX', () => {
  it('generates strings immediately on mount and preserves custom length across UUID mode toggle', async () => {
    const wrapper = mount(RandomStringView)

    // Immediately generates 6 default items of length 32 on load
    const codes = wrapper.findAll('li code')
    expect(codes.length).toBe(6)
    expect(codes[0]?.text().length).toBe(32)

    // Set custom length to 24
    await wrapper.get('#length').setValue(24)
    expect(wrapper.findAll('li code')[0]?.text().length).toBe(24)

    // Apply UUID preset then 6-digit PIN preset
    const presetButtons = wrapper.findAll('button').filter((btn) => btn.text() === 'UUID v4')
    await presetButtons[0]?.trigger('click')
    expect(wrapper.findAll('li code')[0]?.text()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
