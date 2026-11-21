import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  readAnswerSheetStream,
  type ParsedQuestionEvent,
  type ParseReasoningDeltaEvent,
  type ParseStreamOutput,
} from './api'
import { loadPdfCheckpoints, savePdfCheckpoint } from './draft'
import type { OcrPage, PdfCheckpoint, SplitPaperResult, SplitQuestion } from './pdfPipelineTypes'
import type { QuestionGroup, QuestionSourceImage, ReviewSourceImage } from './review'
import type { SubjectType } from './types'

const MAX_PAGES = 20
const BASE = '/api/v1/answer-sheet'
type PageUnit = Extract<PdfCheckpoint, { type: 'page' }>
type QuestionUnit = Extract<PdfCheckpoint, { type: 'question' }>
type Phase = 'ocr' | 'question'

interface PipelineOptions {
  sheetId: string
  signal: AbortSignal
  hintSubject: SubjectType | 'auto'
  onProgress: (update: { phase: Phase; ok: number; total: number; failed: string[] }) => void
  onReasoning: (event: ParseReasoningDeltaEvent, unit: string) => void
  onPartial: (output: ParseStreamOutput) => Promise<void>
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export async function runTwoAtATime<T>(
  units: T[],
  signal: AbortSignal,
  run: (unit: T) => Promise<void>,
): Promise<void> {
  const iterator = units.values()
  const worker = async () => {
    for (const unit of iterator) {
      signal.throwIfAborted()
      await run(unit)
    }
  }
  const results = await Promise.allSettled([worker(), worker()])
  for (const result of results) if (result.status === 'rejected') throw result.reason
}

async function renderPage(
  pdf: PDFDocumentProxy,
  index: number,
  signal: AbortSignal,
): Promise<Blob> {
  const page = await pdf.getPage(index)
  const canvas = document.createElement('canvas')
  const original = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: 1800 / Math.max(original.width, original.height) })
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const task = page.render({ canvas, viewport })
  const cancel = () => task.cancel()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    await task.promise
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('无法生成本页 OCR 图像。'))),
        'image/jpeg',
        0.92,
      )
    })
  } finally {
    signal.removeEventListener('abort', cancel)
    page.cleanup()
    canvas.width = 0
    canvas.height = 0
  }
}

export function assembleOcrPages(units: ReadonlyMap<number, PageUnit>, total: number) {
  const lines: string[] = []
  const pageEndLines: number[] = []
  const metadata = new Map<string, QuestionSourceImage>()
  const assets = new Map<string, Blob>()
  for (let index = 1; index <= total; index++) {
    const unit = units.get(index)
    if (!unit) throw new Error(`第 ${index} 页尚未识别，不能开始拆题。`)
    for (const line of unit.result.markdown.trimEnd().split('\n')) lines.push(line)
    pageEndLines.push(lines.length)
    for (const image of unit.result.sourceImages) metadata.set(image.assetId, image)
    for (const [id, blob] of unit.assets) assets.set(id, blob)
  }
  return { lines, pageEndLines, metadata, assets }
}

type Assembled = ReturnType<typeof assembleOcrPages>

function makeGroup(range: SplitQuestion, paper: Assembled): QuestionGroup {
  const body = paper.lines.slice(range.startLine - 1, range.endLine).join('\n')
  const shared =
    range.sharedLines &&
    paper.lines.slice(range.sharedLines[0] - 1, range.sharedLines[1]).join('\n')
  const sourceMarkdown = shared ? `${shared}\n\n${body}` : body
  const sourceAssetIds = [
    ...new Set(
      Array.from(sourceMarkdown.matchAll(/\[ASSET:([\w-]+) \|/g), (match) => match[1]).filter(
        (id): id is string => !!id,
      ),
    ),
  ]
  return {
    groupId: range.groupId,
    displayNo: range.displayNo,
    sourceMarkdown,
    sourceAssetIds,
    blockIds: [],
  }
}

async function recognizePages(
  file: File,
  checkpoints: PdfCheckpoint[],
  options: PipelineOptions,
): Promise<Assembled> {
  const { sheetId, signal, onProgress, onReasoning } = options
  const { loadPdfPreview } = await import('@/lib/pdf/preview')
  signal.throwIfAborted()
  const task = loadPdfPreview(new Uint8Array(await file.arrayBuffer()))
  const cancel = () => {
    void task.destroy().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    const pdf = await task.promise
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) throw new Error('PDF 最多支持 20 页。')
    const pages = new Map(
      checkpoints.flatMap((unit) =>
        unit.type === 'page' ? [[unit.result.page, unit] as const] : [],
      ),
    )
    const failures = new Map<number, string>()
    const progress = () =>
      onProgress({
        phase: 'ocr',
        ok: pages.size,
        total: pdf.numPages,
        failed: [...failures.values()],
      })
    progress()
    const remaining = Array.from({ length: pdf.numPages }, (_, i) => i + 1).filter(
      (page) => !pages.has(page),
    )
    await runTwoAtATime(remaining, signal, async (page) => {
      try {
        const blob = await renderPage(pdf, page, signal)
        signal.throwIfAborted()
        const form = new FormData()
        form.append('file', blob, `page-${page}.jpg`)
        const output = await readAnswerSheetStream<OcrPage>(
          `${BASE}/ocr-page?page=${page}`,
          form,
          'page_completed',
          (result) => result.sourceImages,
          { signal, onReasoningDelta: (event) => onReasoning(event, `第 ${page} 页`) },
        )
        if (output.result.page !== page || !output.result.markdown.trim())
          throw new Error('OCR 页码或文本无效。')
        if (output.result.sourceImages.some((entry) => !entry.assetId.startsWith(`P${page}_`)))
          throw new Error('配图来源页码不匹配。')
        const unit: PageUnit = { type: 'page', ...output }
        await savePdfCheckpoint(sheetId, unit)
        pages.set(page, unit)
      } catch (error) {
        if (signal.aborted) throw error
        failures.set(page, `第 ${page} 页：${error instanceof Error ? error.message : '识别失败'}`)
      }
      progress()
    })
    if (failures.size)
      throw new Error(`有 ${failures.size} 页未识别，尚未开始拆题。重试只处理失败页。`)
    return assembleOcrPages(pages, pdf.numPages)
  } finally {
    signal.removeEventListener('abort', cancel)
    if (!task.destroyed) await task.destroy()
  }
}

export async function parsePdfByPage(
  file: File,
  options: PipelineOptions,
): Promise<ParseStreamOutput> {
  const { sheetId, hintSubject, signal, onProgress, onReasoning, onPartial } = options
  if (file.size > 20 * 1024 * 1024) throw new Error('上传文件超过 20 MiB 大小上限。')
  const checkpoints = await loadPdfCheckpoints(sheetId)
  const paper = await recognizePages(file, checkpoints, options)
  const splitResponse = await fetch(`${BASE}/split`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markdown: paper.lines.join('\n'),
      pageEndLines: paper.pageEndLines,
      hintSubject: hintSubject === 'auto' ? undefined : hintSubject,
    }),
  })
  if (!splitResponse.ok) {
    const error = (await splitResponse.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `拆题失败 (HTTP ${splitResponse.status})`)
  }
  const split = (await splitResponse.json()) as SplitPaperResult
  const groups = split.questions.map((range) => makeGroup(range, paper))
  const cached = new Map(
    checkpoints.flatMap((unit) =>
      unit.type === 'question' && unit.subject === split.meta.subject
        ? [[unit.result.group.groupId, unit.result] as const]
        : [],
    ),
  )
  const done = new Map<string, ParsedQuestionEvent>()
  const failures = new Map<string, string>()
  for (const group of groups) {
    const result = cached.get(group.groupId)
    if (result && result.group.sourceMarkdown === group.sourceMarkdown)
      done.set(group.groupId, result)
  }
  const snapshot = (): ParseStreamOutput => {
    const ordered = groups.flatMap((group) => done.get(group.groupId) ?? [])
    const blocks = ordered.flatMap((entry) => entry.blocks)
    const assets = new Map(
      ordered.flatMap((entry) => entry.assets.map((asset) => [asset.assetId, asset] as const)),
    )
    const issues = ordered.flatMap((entry) => entry.issues)
    if (split.meta.totalScore <= 0) {
      issues.push({
        severity: 'warning',
        code: 'missing_total_score',
        message: '未能从卷头读取卷面总分，请核对。',
      })
    }
    for (const [i, group] of groups.entries()) {
      const error = failures.get(group.groupId)
      if (error) issues.push({ severity: 'error', code: 'QUESTION_PARSE_FAILED', message: error })
      if (split.questions[i]?.needsReview)
        issues.push({
          severity: 'warning',
          code: 'uncertain_boundary',
          message: `请核对第 ${group.displayNo} 题的原文边界。`,
        })
    }
    return {
      result: {
        semanticData: {
          meta: split.meta,
          blocks,
          assets: [...assets.values()],
          validation: {
            passed: done.size === groups.length && !issues.length,
            calculatedScore: 0,
            issues,
          },
        },
        questionGroups: groups.map((group) => done.get(group.groupId)?.group ?? group),
        sourceImages: [...paper.metadata.values()],
      },
      assets: paper.assets,
    }
  }
  let saved = Promise.resolve()
  const publish = () => {
    const output = snapshot()
    saved = saved.then(() => onPartial(output))
    return saved
  }
  const progress = () =>
    onProgress({
      phase: 'question',
      ok: done.size,
      total: groups.length,
      failed: [...failures.values()],
    })
  progress()
  if (done.size) await publish()
  const pending = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => !done.has(group.groupId))
  await runTwoAtATime(pending, signal, async ({ group, index }) => {
    try {
      const form = new FormData()
      const sourceImages: ReviewSourceImage[] = group.sourceAssetIds.map((assetId, i) => {
        const image = paper.metadata.get(assetId)
        const blob = paper.assets.get(assetId)
        if (!image || !blob) throw new Error(`缺少原题配图 ${assetId}。`)
        const imagePart = `original-${i}`
        form.append(imagePart, blob, imagePart)
        return { ...image, imagePart }
      })
      form.append(
        'payload',
        JSON.stringify({
          group,
          subject: split.meta.subject,
          revision: 'initial',
          blocks: [],
          sourceImages,
          questionIndex: index,
        }),
      )
      const { result } = await readAnswerSheetStream<ParsedQuestionEvent>(
        `${BASE}/questions/parse`,
        form,
        'question_completed',
        () => [],
        { signal, onReasoningDelta: (event) => onReasoning(event, `第 ${group.displayNo} 题`) },
      )
      if (
        result.group.groupId !== group.groupId ||
        result.questionIndex !== index ||
        !result.blocks.length
      )
        throw new Error('返回的题目与请求不匹配。')
      const unit: QuestionUnit = { type: 'question', subject: split.meta.subject, result }
      await savePdfCheckpoint(sheetId, unit)
      done.set(group.groupId, result)
    } catch (error) {
      if (signal.aborted) throw error
      failures.set(
        group.groupId,
        `第 ${group.displayNo} 题：${error instanceof Error ? error.message : '解析失败'}`,
      )
    }
    if (done.size) await publish()
    progress()
  })
  if (failures.size)
    throw new Error(`有 ${failures.size} 道大题未完成。已保存成功题目，重试不会重新 OCR。`)
  return snapshot()
}
