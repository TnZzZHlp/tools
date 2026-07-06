import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EncodingView from '@/views/EncodingView.vue'

describe('EncodingView', () => {
  it('automatically encodes text entered on the left', async () => {
    const wrapper = mount(EncodingView)

    await wrapper.get('#unicode-plain-text').setValue('A你')

    expect((wrapper.get('#unicode-encoded-text').element as HTMLTextAreaElement).value).toBe(
      '\\u0041\\u4F60',
    )
  })

  it('automatically decodes Unicode escapes entered on the right', async () => {
    const wrapper = mount(EncodingView)

    await wrapper.get('#unicode-encoded-text').setValue('\\u4F60\\u597D')

    expect((wrapper.get('#unicode-plain-text').element as HTMLTextAreaElement).value).toBe('你好')
  })
})
