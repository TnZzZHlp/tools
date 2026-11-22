import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  AnswerSheetHttpError,
  readAnswerSheetStream,
  type ParsedQuestionEvent,
  type ParseReasoningDeltaEvent,
  type ParseStreamOutput,
} from './api'
import { getAnswerSheetAuthHeaders } from './auth'
import { loadPdfCheckpoints, savePdfCheckpoint } from './draft'
import type { OcrPage, PdfCheckpoint, SplitPaperResult, SplitQuestion } from './pdfPipelineTypes'
import type { QuestionGroup, QuestionSourceImage, ReviewSourceImage } from './review'
import { sanitizeBigQuestionOmrBlocks } from './sanitize'
import type { SubjectType } from './types'

const MAX_PAGES = 20
const PARSE_CONCURRENCY = 4
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
  onPageOcr?: (page: OcrPage) => void
  onQuestionParsed?: (event: ParsedQuestionEvent) => void
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export async function runWithConcurrency<T>(
  units: T[],
  signal: AbortSignal,
  run: (unit: T) => Promise<void>,
  concurrency = PARSE_CONCURRENCY,
): Promise<void> {
  const iterator = units.values()
  const worker = async () => {
    for (const unit of iterator) {
      signal.throwIfAborted()
      await run(unit)
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, units.length || 1))
  const results = await Promise.allSettled(Array.from({ length: workerCount }, () => worker()))
  for (const result of results) if (result.status === 'rejected') throw result.reason
}

export async function runTwoAtATime<T>(
  units: T[],
  signal: AbortSignal,
  run: (unit: T) => Promise<void>,
): Promise<void> {
  return runWithConcurrency(units, signal, run, PARSE_CONCURRENCY)
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

const SUBJECT_KEYWORDS: Array<{ subject: SubjectType; pattern: RegExp }> = [
  { subject: 'chinese', pattern: /语\s*文/ },
  { subject: 'math', pattern: /数\s*学/ },
  { subject: 'english', pattern: /英\s*语/ },
  { subject: 'physics', pattern: /物\s*理/ },
  { subject: 'chemistry', pattern: /化\s*学/ },
  { subject: 'biology', pattern: /生\s*物/ },
  { subject: 'politics', pattern: /思\s*想\s*政\s*治|政\s*治|道\s*德\s*与\s*法\s*治/ },
  { subject: 'history', pattern: /历\s*史/ },
  { subject: 'geography', pattern: /地\s*理/ },
]

export function inferSubjectFromText(
  ...sources: Array<string | undefined>
): SubjectType | undefined {
  for (const raw of sources) {
    if (!raw) continue
    const text = raw.trim()
    if (!text) continue
    for (const entry of SUBJECT_KEYWORDS) {
      if (entry.pattern.test(text)) {
        return entry.subject
      }
    }
  }
  return undefined
}

const NOISE_TITLE_RE =
  /^(?:\d+\s*[.．、]|[（(]\d+[)）])?\s*(?:作答前|答题前|作答时|答题时|考试结束后|注意事项|考生务必|保持卡面|请在|本试卷|试卷共|满分)/

function isValidExamTitle(candidate: string): boolean {
  const text = candidate.trim()
  if (!text || text.length > 48) return false
  if (NOISE_TITLE_RE.test(text)) return false
  if (/[。！？]$/.test(text)) return false
  return true
}

function extractTitleFromFirstPage(lines: string[], fallbackFileName: string): string {
  const candidates: string[] = []
  for (const raw of lines.slice(0, 12)) {
    const line = raw
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .trim()
    if (!line) continue
    if (/^(?:注意事项|一、|第[一二]部分|选择题|机密|绝密|保密)/.test(line)) break
    if (/^第\s*\d+\s*页/.test(line)) continue
    if (isValidExamTitle(line)) {
      candidates.push(line)
      if (candidates.length >= 2) break
    }
  }
  if (candidates.length > 0) {
    return candidates.join(' ')
  }
  const fromFile = fallbackFileName
    .replace(/\.[^.]+$/, '')
    .replace(/^\d{10,}/, '')
    .replace(/试题及答案$|试卷及答案$|及答案$/, '')
    .trim()
  return fromFile || '未命名试卷'
}

export function sanitizeMetaTitle(
  metaTitle: string,
  firstPageLines: string[],
  fallbackFileName: string,
): string {
  const cleaned = metaTitle.trim()
  if (isValidExamTitle(cleaned)) return cleaned
  return extractTitleFromFirstPage(firstPageLines, fallbackFileName)
}

export function isAnswerOrAdPage(markdown: string): boolean {
  const headLines = markdown
    .split('\n')
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 8)
  const headText = headLines.join(' ')
  if (/^(?:参考答案|答案及解析|试题答案|评分标准|评分细则)(?:\s|$)/.test(headLines[0] ?? '')) {
    return true
  }
  if (
    /^(?:关于我们|北京高考在线|京考一点通|微信搜一搜|扫码关注)/.test(headLines[0] ?? '') ||
    (headText.includes('关于我们') && /微信公众号|官方网站|咨询热线/.test(markdown))
  ) {
    return true
  }
  return false
}

export function assembleOcrPages(units: ReadonlyMap<number, PageUnit>, total: number) {
  const lines: string[] = []
  const pageEndLines: number[] = []
  const metadata = new Map<string, QuestionSourceImage>()
  const assets = new Map<string, Blob>()
  for (let index = 1; index <= total; index++) {
    const unit = units.get(index)
    if (!unit) throw new Error(`第 ${index} 页尚未识别，不能开始拆题。`)
    // Stop assembling once we hit an appended "参考答案" or promotional "关于我们" page after page 1
    if (index > 1 && isAnswerOrAdPage(unit.result.markdown)) {
      continue
    }
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
  const { sheetId, signal, onProgress, onReasoning, onPageOcr } = options
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
    for (const unit of pages.values()) {
      onPageOcr?.(unit.result)
    }
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
        const request = (retry = false) =>
          readAnswerSheetStream<OcrPage>(
            `${BASE}/ocr-page?page=${page}`,
            form,
            'page_completed',
            (result) => result.sourceImages,
            {
              signal,
              onReasoningDelta: (event) =>
                onReasoning(event, `第 ${page} 页${retry ? '（重试）' : ''}`),
            },
          )
        const output = await request().catch((error: unknown) => {
          if (!(error instanceof AnswerSheetHttpError) || error.status !== 554) throw error
          signal.throwIfAborted()
          return request(true)
        })
        if (output.result.page !== page || !output.result.markdown.trim())
          throw new Error('OCR 页码或文本无效。')
        if (output.result.sourceImages.some((entry) => !entry.assetId.startsWith(`P${page}_`)))
          throw new Error('配图来源页码不匹配。')
        const unit: PageUnit = { type: 'page', ...output }
        await savePdfCheckpoint(sheetId, unit)
        pages.set(page, unit)
        onPageOcr?.(unit.result)
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
  const { sheetId, hintSubject, signal, onProgress, onReasoning, onPartial, onQuestionParsed } =
    options
  if (file.size > 20 * 1024 * 1024) throw new Error('上传文件超过 20 MiB 大小上限。')
  const checkpoints = await loadPdfCheckpoints(sheetId)
  const paper = await recognizePages(file, checkpoints, options)
  const firstPageHeader = paper.lines.slice(0, 15).join('\n')
  const inferredHintSubject =
    hintSubject !== 'auto' ? hintSubject : inferSubjectFromText(firstPageHeader, file.name)

  const splitResponse = await fetch(`${BASE}/split`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...getAnswerSheetAuthHeaders() },
    body: JSON.stringify({
      markdown: paper.lines.join('\n'),
      pageEndLines: paper.pageEndLines,
      hintSubject: inferredHintSubject,
    }),
  })
  if (!splitResponse.ok) {
    const error = (await splitResponse.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `拆题失败 (HTTP ${splitResponse.status})`)
  }
  const split = (await splitResponse.json()) as SplitPaperResult
  split.meta = {
    ...split.meta,
    title: sanitizeMetaTitle(split.meta.title, paper.lines, file.name),
  }
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
    if (result && result.group.sourceMarkdown === group.sourceMarkdown) {
      const sanitized = sanitizeBigQuestionOmrBlocks(result.group, result.blocks)
      const normalizedResult: ParsedQuestionEvent = {
        ...result,
        group: sanitized.group,
        blocks: sanitized.blocks,
      }
      done.set(group.groupId, normalizedResult)
      onQuestionParsed?.(normalizedResult)
    }
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
      const sanitized = sanitizeBigQuestionOmrBlocks(result.group, result.blocks)
      const normalizedResult: ParsedQuestionEvent = {
        ...result,
        group: sanitized.group,
        blocks: sanitized.blocks,
      }
      const unit: QuestionUnit = {
        type: 'question',
        subject: split.meta.subject,
        result: normalizedResult,
      }
      await savePdfCheckpoint(sheetId, unit)
      done.set(group.groupId, normalizedResult)
      onQuestionParsed?.(normalizedResult)
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
