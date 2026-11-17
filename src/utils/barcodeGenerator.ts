import JsBarcode from 'jsbarcode'

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface BarcodeSize {
  width: number
  height: number
}

export interface GeneratedBarcode {
  content: string
  svg: string
  error: string
}

export function parseBarcodeContents(input: string): string[] {
  return input
    .replace(/，/g, ',')
    .split(/[,\r\n]+/)
    .map((content) => content.trim())
    .filter(Boolean)
}

export function generateBarcode(content: string): GeneratedBarcode {
  if (!/^[\x20-\x7e]+$/.test(content)) {
    return { content, svg: '', error: 'CODE128 仅支持英文字母、数字和 ASCII 符号，不支持中文。' }
  }

  try {
    const svg = document.createElementNS(SVG_NS, 'svg')
    JsBarcode(svg, content, {
      format: 'CODE128',
      width: 2,
      height: 80,
      margin: 20,
      fontSize: 18,
      displayValue: true,
      background: '#ffffff',
      lineColor: '#000000',
    })
    svg.setAttribute('preserveAspectRatio', 'none')
    return { content, svg: new XMLSerializer().serializeToString(svg), error: '' }
  } catch {
    return { content, svg: '', error: '无法生成此条码，请检查内容。' }
  }
}

export function isValidBarcodeSize(size: BarcodeSize): boolean {
  return [size.width, size.height].every(
    (value) => Number.isFinite(value) && value >= 1 && value <= 1000,
  )
}

export function buildBarcodeExport(barcodes: GeneratedBarcode[], size: BarcodeSize): string {
  if (!isValidBarcodeSize(size)) throw new Error('宽高必须为 1 至 1000 毫米。')
  if (!barcodes.length || barcodes.some((barcode) => !barcode.svg || barcode.error)) {
    throw new Error('请先生成有效的条码。')
  }

  const root = document.createElementNS(SVG_NS, 'svg')
  const totalHeight = size.height * barcodes.length
  root.setAttribute('width', `${size.width}mm`)
  root.setAttribute('height', `${totalHeight}mm`)
  root.setAttribute('viewBox', `0 0 ${size.width} ${totalHeight}`)

  barcodes.forEach((barcode, index) => {
    const parsed = new DOMParser().parseFromString(barcode.svg, 'image/svg+xml')
    const svg = document.importNode(parsed.documentElement, true)
    svg.setAttribute('x', '0')
    svg.setAttribute('y', String(index * size.height))
    svg.setAttribute('width', String(size.width))
    svg.setAttribute('height', String(size.height))
    root.appendChild(svg)
  })

  return new XMLSerializer().serializeToString(root)
}
