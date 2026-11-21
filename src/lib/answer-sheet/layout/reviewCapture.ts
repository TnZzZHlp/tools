import type { QuestionGroup, QuestionRenderFragment, WritableAreaMeasurement } from '../review'
import { mm, waitForResources } from './measure'

interface AreaMark {
  measurement: WritableAreaMeasurement
  topPx: number
}

const precision = (value: number) => Math.round(value * 100) / 100

function inspect(block: HTMLElement, blockId: string): AreaMark[] {
  const box = block.getBoundingClientRect()
  const zoom = box.width / Number.parseFloat(getComputedStyle(block).width)
  const size = (px: number) => precision(mm(px / zoom))
  const area = (node: Element, measurement: WritableAreaMeasurement): AreaMark => {
    const rect = node.getBoundingClientRect()
    return {
      measurement,
      topPx: (rect.top - box.top + rect.height / 2) / zoom,
    }
  }
  const areas: AreaMark[] = []
  for (const line of block.querySelectorAll<HTMLElement>('[data-writing-line]')) {
    const rule = line.querySelector('.sheet-rule, .tail')
    if (!rule) continue
    const rect = rule.getBoundingClientRect()
    const writableWidthMm = size(
      rule.classList.contains('tail') ? line.getBoundingClientRect().right - rect.left : rect.width,
    )
    const heightMm = precision(mm(Number.parseFloat(getComputedStyle(line).lineHeight)))
    if (writableWidthMm > 0 && heightMm > 0)
      areas.push(
        area(rule, {
          type: 'writing_lines',
          blockId,
          subNo: line.closest<HTMLElement>('[data-sub-no]')?.dataset.subNo,
          lines: [{ heightMm, writableWidthMm }],
        }),
      )
  }
  for (const blank of block.querySelectorAll<HTMLElement>(
    '.blank .sheet-rule, .segment .sheet-rule',
  )) {
    const rect = blank.getBoundingClientRect()
    areas.push(
      area(blank, {
        type: 'writing_lines',
        blockId,
        subNo: blank.closest<HTMLElement>('[data-sub-no]')?.dataset.subNo,
        lines: [{ heightMm: size(rect.height), writableWidthMm: size(rect.width) }],
      }),
    )
  }
  for (const node of block.querySelectorAll<HTMLElement>(
    '[data-blank-area], [data-drawing-area]',
  )) {
    const rect = node.getBoundingClientRect()
    const header = node.querySelector('.sheet-label')?.getBoundingClientRect()
    const top = header ? header.bottom : rect.top
    const heightMm = size(rect.bottom - top)
    if (heightMm > 0)
      areas.push({
        ...area(node, {
          type: node.hasAttribute('data-blank-area') ? 'blank_box' : 'drawing_area',
          blockId,
          subNo: node.dataset.subNo,
          widthMm: size(rect.width),
          heightMm,
        }),
        topPx: (top - box.top + (rect.bottom - top) / 2) / zoom,
      })
  }
  const grids = block.querySelectorAll('[data-grid-number]')
  const first = grids.item(0)
  if (first) {
    const rect = first.getBoundingClientRect()
    areas.push(
      area(first, {
        type: 'composition_grid',
        blockId,
        gridCount: grids.length,
        cellWidthMm: size(rect.width),
        cellHeightMm: size(rect.height),
      }),
    )
  }
  return areas
}

function label(area: WritableAreaMeasurement): string {
  const prefix = area.subNo ? `${area.subNo} ` : ''
  switch (area.type) {
    case 'writing_lines':
      return `${prefix}${area.lines.map((line) => `高 ${line.heightMm} × 宽 ${line.writableWidthMm} mm`).join(' / ')}`
    case 'composition_grid':
      return `${prefix}${area.gridCount} 格，每格 ${area.cellWidthMm} × ${area.cellHeightMm} mm`
    default:
      return `${prefix}${area.type === 'blank_box' ? '空白区' : '作图区'} ${area.widthMm} × ${area.heightMm} mm`
  }
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size > 4 * 1024 * 1024) reject(new Error('复审图超出上传上限。'))
      else resolve(blob)
    }, 'image/png')
  })
}

async function annotate(node: HTMLElement, marks: AreaMark[], heading: string): Promise<Blob> {
  const { domToCanvas } = await import('modern-screenshot')
  const width = Math.ceil(Number.parseFloat(getComputedStyle(node).width))
  const height = Math.ceil(Number.parseFloat(getComputedStyle(node).height))
  const captureScale = 2
  const source = await domToCanvas(node, {
    width,
    height,
    scale: captureScale,
    backgroundColor: 'white',
  })
  const canvas = document.createElement('canvas')
  canvas.width = width + 265
  const ordered = [...marks].sort((a, b) => a.topPx - b.topPx)
  let lastY = 50
  const labelY = ordered.map((mark) => (lastY = Math.max(lastY + 18, mark.topPx + 30)))
  canvas.height = Math.max(height + 30, lastY + 10)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成复审标注图。')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'black'
  ctx.font = '13px sans-serif'
  ctx.fillText(heading, 10, 19)
  const lineCount = marks.reduce(
    (count, { measurement }) =>
      count + (measurement.type === 'writing_lines' ? measurement.lines.length : 0),
    0,
  )
  if (lineCount) ctx.fillText(`本片段：${lineCount} 处可写横线`, width + 19, 47)
  ctx.drawImage(source, 0, 30, width, height)
  for (const [index, mark] of ordered.entries()) {
    const y = labelY[index] ?? lastY
    ctx.strokeStyle = 'black'
    ctx.beginPath()
    ctx.moveTo(width, mark.topPx + 30)
    ctx.lineTo(width + 5, y - 4)
    ctx.lineTo(width + 14, y - 4)
    ctx.stroke()
    ctx.fillText(label(mark.measurement), width + 19, y, 240)
  }
  return encode(canvas)
}

export async function captureQuestionReview(
  root: HTMLElement,
  group: Pick<QuestionGroup, 'displayNo' | 'blockIds'>,
) {
  await waitForResources(root)
  const fragments: QuestionRenderFragment[] = []
  const images = new Map<string, Blob>()
  const allowed = new Set(group.blockIds)
  const hashes: string[] = []
  const found = new Set<string>()
  for (const [pageIndex, page] of Array.from(root.querySelectorAll('.sheet-page')).entries()) {
    for (const [columnIndex, column] of Array.from(
      page.querySelectorAll('.sheet-column'),
    ).entries()) {
      for (const block of column.querySelectorAll<HTMLElement>('[data-block-id]')) {
        const blockId = block.dataset.blockId ?? ''
        if (!allowed.has(blockId)) continue
        found.add(blockId)
        const marks = inspect(block, blockId)
        const fragmentIndex = fragments.length
        if (fragmentIndex >= 32) throw new Error('这道大题的复审片段超过上传上限。')
        const imagePart = `review-${fragmentIndex}`
        const picture = await annotate(
          block,
          marks,
          `第 ${group.displayNo} 题 · 第 ${pageIndex + 1} 面 · 第 ${columnIndex + 1} 栏 · 片段 ${fragmentIndex + 1}`,
        )
        fragments.push({
          pageIndex,
          columnIndex,
          fragmentIndex,
          imagePart,
          areas: marks.map((mark) => mark.measurement),
        })
        images.set(imagePart, picture)
        hashes.push(await sha(await picture.arrayBuffer()))
      }
    }
  }
  if (!fragments.length || found.size !== allowed.size)
    throw new Error('当前画布缺少这道大题的渲染片段。')
  const fingerprint = await sha(
    new TextEncoder().encode(JSON.stringify([fragments, hashes])).buffer,
  )
  return { fragments, images, fragmentCount: fragments.length, fingerprint }
}

async function sha(input: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
