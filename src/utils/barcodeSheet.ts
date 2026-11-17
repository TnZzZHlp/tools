import {
  buildBarcodeExport,
  isValidBarcodeSize,
  type BarcodeSize,
  type GeneratedBarcode,
} from './barcodeGenerator'

export const A4_SIZE: BarcodeSize = { width: 210, height: 297 }
export const SHEET_MARGIN = 10
export const BARCODE_GAP = 5

export function getBarcodeSheetLayout(size: BarcodeSize) {
  if (!isValidBarcodeSize(size)) throw new Error('宽高必须为 1 至 1000 毫米。')
  const columns = Math.floor(
    (A4_SIZE.width - SHEET_MARGIN * 2 + BARCODE_GAP) / (size.width + BARCODE_GAP),
  )
  const rows = Math.floor(
    (A4_SIZE.height - SHEET_MARGIN * 2 + BARCODE_GAP) / (size.height + BARCODE_GAP),
  )
  if (columns < 1 || rows < 1) {
    throw new Error('条码尺寸超出 A4 可打印区域，宽度不能超过 190 毫米，高度不能超过 277 毫米。')
  }
  return { columns, rows, capacity: columns * rows }
}

export function buildBarcodeSheets(barcodes: GeneratedBarcode[], size: BarcodeSize): string[] {
  const { columns, capacity } = getBarcodeSheetLayout(size)
  if (!barcodes.length) throw new Error('请先生成有效的条码。')
  const sheets: string[] = []
  for (let offset = 0; offset < barcodes.length; offset += capacity) {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    root.setAttribute('width', `${A4_SIZE.width}mm`)
    root.setAttribute('height', `${A4_SIZE.height}mm`)
    root.setAttribute('viewBox', `0 0 ${A4_SIZE.width} ${A4_SIZE.height}`)
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    background.setAttribute('width', String(A4_SIZE.width))
    background.setAttribute('height', String(A4_SIZE.height))
    background.setAttribute('fill', '#ffffff')
    root.appendChild(background)
    barcodes.slice(offset, offset + capacity).forEach((barcode, index) => {
      const parsed = new DOMParser().parseFromString(
        buildBarcodeExport([barcode], size),
        'image/svg+xml',
      )
      const svg = document.importNode(parsed.documentElement, true)
      svg.setAttribute('x', String(SHEET_MARGIN + (index % columns) * (size.width + BARCODE_GAP)))
      svg.setAttribute(
        'y',
        String(SHEET_MARGIN + Math.floor(index / columns) * (size.height + BARCODE_GAP)),
      )
      svg.setAttribute('width', String(size.width))
      svg.setAttribute('height', String(size.height))
      root.appendChild(svg)
    })
    sheets.push(new XMLSerializer().serializeToString(root))
  }
  return sheets
}
