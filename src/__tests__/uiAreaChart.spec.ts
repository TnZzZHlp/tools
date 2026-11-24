import { describe, expect, it } from 'vitest'
import { areaPaths } from '@/components/ui/area-chart/geometry'

describe('areaPaths', () => {
  it('treats a missing sample as zero', () => {
    const values = [1, 1, 1]
    Reflect.deleteProperty(values, 1)

    expect(areaPaths(values).points.map((point) => point.value)).toEqual([1, 0, 1])
  })
})
