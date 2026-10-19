import { File } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { degrees, PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { inspectPdf, mergePdfs } from '@/lib/pdf/merge'

describe('PDF 合并', () => {
  it('按文件和原始页序合并，将增量旋转叠加到原始方向且不改写源文件', async () => {
    const first = await PDFDocument.create()
    first.addPage([200, 300]).setRotation(degrees(270))
    first.addPage([400, 500])
    const second = await PDFDocument.create()
    second.addPage([600, 700]).setRotation(degrees(90))
    const firstFile = new File([new Uint8Array(await first.save())], 'first.pdf')
    const secondFile = new File([new Uint8Array(await second.save())], 'second.pdf')

    const merged = await mergePdfs([
      { file: secondFile, rotations: [90] },
      { file: firstFile, rotations: [90, 270] },
    ])
    const mergedBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(merged)
    })
    const output = await PDFDocument.load(new Uint8Array(mergedBytes))
    expect(output.getPages().map((page) => [page.getWidth(), page.getRotation().angle])).toEqual([
      [600, 180],
      [200, 0],
      [400, 270],
    ])
    const original = await PDFDocument.load(new Uint8Array(await firstFile.arrayBuffer()))
    expect(original.getPages().map((page) => page.getRotation().angle)).toEqual([270, 0])
  })

  it('收到取消信号后停止合并，不生成结果', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const file = new File([new Uint8Array(await document.save())], 'input.pdf')
    const controller = new AbortController()
    const result = mergePdfs([{ file, rotations: [0] }], controller.signal)
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('读取时拒绝 XFA 表单，不让库静默删除表单内容', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    document.catalog.getOrCreateAcroForm().dict.set(PDFName.of('XFA'), PDFString.of('xfa'))
    await expect(inspectPdf(await document.save())).rejects.toThrow('不支持 XFA 表单')
  })

  it('拒绝页面与旋转记录数量不一致的输入，避免遗漏页面', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const file = new File([new Uint8Array(await document.save())], 'input.pdf')
    await expect(mergePdfs([{ file, rotations: [] }])).rejects.toThrow('页面数量发生变化')
  })
})
