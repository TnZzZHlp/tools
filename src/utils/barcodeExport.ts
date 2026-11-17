import { buildBarcodeExport, type BarcodeSize, type GeneratedBarcode } from './barcodeGenerator'

export type BarcodeExportFormat = 'svg' | 'jpg' | 'pdf'

const DPI = 300

async function renderCanvas(svg: string, size: BarcodeSize): Promise<HTMLCanvasElement> {
  const width = Math.round((size.width / 25.4) * DPI)
  const height = Math.round((size.height / 25.4) * DPI)
  if (width > 32767 || height > 32767 || width * height > 32_000_000) {
    throw new Error('图片尺寸过大，请减小宽高、减少条码数量或使用 SVG 格式。')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持图片导出，请使用 SVG 格式。')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('条码图片生成失败。'))
      image.src = url
    })
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败。'))),
      type,
      0.98,
    )
  })
}

function setJpegDensity(bytes: Uint8Array): void {
  for (let index = 2; index + 17 < bytes.length; ) {
    if (bytes[index] !== 0xff) break
    const marker = bytes[index + 1]
    if (marker === 0xda || marker === 0xd9) break
    const length = (bytes[index + 2]! << 8) | bytes[index + 3]!
    if (length < 2) break
    if (
      marker === 0xe0 &&
      bytes[index + 4] === 0x4a &&
      bytes[index + 5] === 0x46 &&
      bytes[index + 6] === 0x49 &&
      bytes[index + 7] === 0x46 &&
      bytes[index + 8] === 0
    ) {
      bytes[index + 11] = 1
      bytes[index + 12] = DPI >> 8
      bytes[index + 13] = DPI & 0xff
      bytes[index + 14] = DPI >> 8
      bytes[index + 15] = DPI & 0xff
      return
    }
    index += length + 2
  }
  throw new Error('浏览器生成的 JPG 不支持写入实际打印尺寸，请使用 PDF 或 SVG。')
}

export async function createBarcodeFile(
  barcodes: GeneratedBarcode[],
  size: BarcodeSize,
  format: BarcodeExportFormat,
): Promise<Blob> {
  const svg = buildBarcodeExport(barcodes, size)
  if (format === 'svg') return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })

  if (format === 'jpg') {
    const canvas = await renderCanvas(svg, { ...size, height: size.height * barcodes.length })
    const blob = await canvasBlob(canvas, 'image/jpeg')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    setJpegDensity(bytes)
    return new Blob([bytes], { type: 'image/jpeg' })
  }

  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const width = (size.width / 25.4) * 72
  const height = (size.height / 25.4) * 72
  for (const barcode of barcodes) {
    const canvas = await renderCanvas(buildBarcodeExport([barcode], size), size)
    const png = await canvasBlob(canvas, 'image/png')
    const image = await document.embedPng(await png.arrayBuffer())
    document.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  }
  return new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' })
}

export function downloadBarcodeFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
