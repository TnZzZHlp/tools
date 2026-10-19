import { degrees, PDFDocument, PDFName } from 'pdf-lib'

export interface PdfMergeSource {
  file: Pick<File, 'arrayBuffer' | 'name'>
  rotations: number[]
}

export function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360
}

export async function inspectPdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes)
  if (!document.getPageCount()) throw new Error('PDF 没有可合并的页面')
  if (document.catalog.getAcroForm()?.dict.has(PDFName.of('XFA')))
    throw new Error('不支持 XFA 表单，请先导出为普通 PDF')
  return document.getPages().map((page) => normalizeRotation(page.getRotation().angle))
}

async function cancellationCheckpoint(signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (!signal) return
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  signal.throwIfAborted()
}

export async function mergePdfs(sources: PdfMergeSource[], signal?: AbortSignal) {
  if (!sources.length) throw new Error('请先添加 PDF 文件')
  const output = await PDFDocument.create()
  for (const source of sources) {
    await cancellationCheckpoint(signal)
    const bytes = new Uint8Array(await source.file.arrayBuffer())
    signal?.throwIfAborted()
    const input = await PDFDocument.load(bytes)
    await cancellationCheckpoint(signal)
    if (source.rotations.length !== input.getPageCount())
      throw new Error('页面数量发生变化，请重新添加文件')
    if (input.catalog.getAcroForm()?.dict.has(PDFName.of('XFA')))
      throw new Error('不支持 XFA 表单，请先导出为普通 PDF')
    const form = input.getForm()
    if (form.getFields().length) form.flatten()
    const pages = await output.copyPages(input, input.getPageIndices())
    await cancellationCheckpoint(signal)
    for (const [index, page] of pages.entries()) {
      const rotation = source.rotations[index]!
      if (!Number.isFinite(rotation) || rotation % 90 !== 0)
        throw new Error('旋转角度必须为 90° 的倍数')
      page.setRotation(degrees(normalizeRotation(page.getRotation().angle + rotation)))
      output.addPage(page)
    }
  }
  await cancellationCheckpoint(signal)
  const bytes = new Uint8Array(await output.save())
  signal?.throwIfAborted()
  return new Blob([bytes], { type: 'application/pdf' })
}

export function pdfErrorMessage(error: unknown) {
  if (error instanceof Error && /encrypt|password/i.test(`${error.name} ${error.message}`)) {
    return '不支持加密或受密码保护的 PDF，请先解密后重新添加'
  }
  return error instanceof Error ? error.message : '无法读取 PDF，请确认文件未损坏'
}
