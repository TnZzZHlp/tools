import { describe, expect, it } from 'vitest'

import { getBarcodeSheetLayout } from '@/utils/barcodeSheet'

describe('A4 barcode layout', () => {
  it('fits multiple actual-size barcodes on one A4 page', () => {
    expect(getBarcodeSheetLayout({ width: 60, height: 30 })).toEqual({
      columns: 3,
      rows: 8,
      capacity: 24,
    })
  })

  it('rejects a barcode wider than the printable area instead of scaling it', () => {
    expect(() => getBarcodeSheetLayout({ width: 191, height: 30 })).toThrow('A4')
  })
})
