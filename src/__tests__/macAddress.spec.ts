import { describe, expect, it } from 'vitest'

import { buildMacAddress, extractMacSuffix, normalizeMacPrefix } from '@/utils/macAddress'

describe('MAC address helpers', () => {
  it('extracts a hyphenated suffix', () => {
    expect(extractMacSuffix('MAC: 8F-D8-25-68')).toBe('8F-D8-25-68')
  })

  it('extracts the last four octets from a full address', () => {
    expect(extractMacSuffix('MAC AA-BB-CC-8F-D8-25-68')).toBe('8F-D8-25-68')
  })

  it('supports colon separators and common OCR confusion', () => {
    expect(extractMacSuffix('0D:8O:13:DA')).toBe('0D-80-13-DA')
  })

  it('also accepts OCR output without separators', () => {
    expect(extractMacSuffix('MAC8FD82568')).toBe('8F-D8-25-68')
  })

  it('normalizes the manually supplied prefix', () => {
    expect(normalizeMacPrefix('aa bb')).toBe('AA-BB')
    expect(buildMacAddress('aabb', '8F-D8-25-68')).toBe('AA-BB-8F-D8-25-68')
  })
})
