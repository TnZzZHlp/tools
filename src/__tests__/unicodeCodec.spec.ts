import { describe, expect, it } from 'vitest'

import { decodeUnicode, encodeUnicode } from '@/utils/unicodeCodec'

describe('unicodeCodec', () => {
  it('encodes text as UTF-16 Unicode escape sequences', () => {
    expect(encodeUnicode('A你好')).toBe('\\u0041\\u4F60\\u597D')
  })

  it('round-trips supplementary characters as surrogate pairs', () => {
    const source = '你好 👋'
    const encoded = encodeUnicode(source)

    expect(encoded).toBe('\\u4F60\\u597D\\u0020\\uD83D\\uDC4B')
    expect(decodeUnicode(encoded)).toBe(source)
  })

  it('decodes code point escape syntax', () => {
    expect(decodeUnicode('\\u{1F44B}\\u0020\\u{4F60}')).toBe('👋 你')
  })

  it('keeps incomplete and out-of-range escapes unchanged', () => {
    expect(decodeUnicode('\\u4F6 \\u{110000}')).toBe('\\u4F6 \\u{110000}')
  })
})
