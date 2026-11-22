import { getAnswerSheetAuthHeaders } from './auth'
import type { DraftSource } from './draft'
import type {
  AnswerSheetParseResult,
  QuestionGroup,
  QuestionReparseInput,
  QuestionReparseResult,
  QuestionReviewInput,
  QuestionReviewResult,
  QuestionSourceImage,
} from './review'
import type { AnswerSheetBlock, SheetAsset, SheetMeta, SubjectType, ValidationIssue } from './types'

export interface ParseStageUpdateEvent {
  stage: string
  progress: number
  message: string
}

export interface ParseAssetChunkEvent {
  assetId: string
  chunkIndex: number
  chunkCount: number
  dataBase64: string
}

export interface ParseNormalizedEvent {
  markdown: string
  questionGroups: QuestionGroup[]
  sourceImages: QuestionSourceImage[]
  hintSubject?: SubjectType
}

export class AnswerSheetHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface ParseFailedEvent {
  code: string
  message: string
}

export interface ParseStartedEvent {
  meta: SheetMeta
  totalQuestions: number
}

export interface ParsedQuestionEvent {
  questionIndex: number
  group: QuestionGroup
  blocks: AnswerSheetBlock[]
  assets: SheetAsset[]
  sourceImages: QuestionSourceImage[]
  issues: ValidationIssue[]
}

export interface ParseReasoningDeltaEvent {
  callId: number
  stage: string
  text: string
}

export interface ParseStreamCallbacks {
  onReasoningDelta?: (event: ParseReasoningDeltaEvent) => void
  onStarted?: (event: ParseStartedEvent) => void
  onQuestionParsed?: (event: ParsedQuestionEvent) => void
  onStageUpdate?: (event: ParseStageUpdateEvent) => void
  onNormalized?: (event: ParseNormalizedEvent) => void
  signal?: AbortSignal
}

export interface ParseStreamOutput {
  result: AnswerSheetParseResult
  assets: Map<string, Blob>
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function parseAnswerSheetStream(
  source: DraftSource,
  hintSubject?: SubjectType | 'auto',
  callbacks?: ParseStreamCallbacks,
): Promise<ParseStreamOutput> {
  const formData = new FormData()
  if (source.type === 'file') {
    if (source.file.size > 20 * 1024 * 1024) {
      throw new Error('上传文件超过 20MB 大小上限，请压缩或裁剪后重试。')
    }
    formData.append('file', source.file)
  } else {
    if (!source.text.trim()) {
      throw new Error('请输入或粘贴试卷文本内容。')
    }
    formData.append('text', source.text)
  }
  if (hintSubject && hintSubject !== 'auto') {
    formData.append('hintSubject', hintSubject)
  }

  return readAnswerSheetStream<AnswerSheetParseResult>(
    '/api/v1/answer-sheet/parse',
    formData,
    'completed',
    (result) => [...result.sourceImages, ...result.semanticData.assets],
    callbacks,
  )
}

export async function readAnswerSheetStream<T>(
  url: string,
  formData: FormData,
  terminal: string,
  requiredAssets: (result: T) => QuestionSourceImage[],
  callbacks?: ParseStreamCallbacks,
): Promise<{ result: T; assets: Map<string, Blob> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: getAnswerSheetAuthHeaders(),
    body: formData,
    signal: callbacks?.signal,
  })

  if (!response.ok) {
    if (response.status === 554) {
      await response.body?.cancel().catch(() => undefined)
      throw new AnswerSheetHttpError(554, '答题卡 API 的 EdgeOne 回源响应超时（554）。')
    }
    let detail = ''
    try {
      const errJson = (await response.json()) as { message?: string; error?: string }
      detail = errJson.message ?? errJson.error ?? ''
    } catch {
      detail = await response.text().catch(() => '')
    }
    throw new AnswerSheetHttpError(
      response.status,
      detail || `解析请求失败 (HTTP ${response.status})`,
    )
  }

  if (!response.body) {
    throw new Error('解析服务未返回流式响应数据。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const chunkBuckets = new Map<string, { chunkCount: number; parts: Map<number, Uint8Array> }>()
  let completedResult: T | null = null
  let streamFailedError: Error | null = null

  function processEventBlock(block: string) {
    const lines = block.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (!dataLines.length) return
    const rawData = dataLines.join('\n')
    let payload: unknown
    try {
      payload = JSON.parse(rawData)
    } catch {
      return
    }

    const dataObj = payload as Record<string, unknown>
    const resolvedType =
      eventName !== 'message'
        ? eventName
        : typeof dataObj.type === 'string'
          ? dataObj.type
          : 'stage_update'

    if (resolvedType === 'stage_update') {
      callbacks?.onStageUpdate?.({
        stage: String(dataObj.stage ?? 'parsing'),
        progress: typeof dataObj.progress === 'number' ? dataObj.progress : 0,
        message: String(dataObj.message ?? '正在解析试卷...'),
      })
    } else if (resolvedType === 'reasoning_delta') {
      callbacks?.onReasoningDelta?.(payload as ParseReasoningDeltaEvent)
    } else if (resolvedType === 'parse_started') {
      callbacks?.onStarted?.(payload as ParseStartedEvent)
    } else if (resolvedType === 'question_parsed') {
      callbacks?.onQuestionParsed?.(payload as ParsedQuestionEvent)
    } else if (resolvedType === 'asset_chunk') {
      const chunk = payload as ParseAssetChunkEvent
      if (!chunk.assetId || typeof chunk.chunkIndex !== 'number') return
      let bucket = chunkBuckets.get(chunk.assetId)
      if (!bucket) {
        bucket = { chunkCount: chunk.chunkCount, parts: new Map() }
        chunkBuckets.set(chunk.assetId, bucket)
      }
      bucket.chunkCount = chunk.chunkCount
      bucket.parts.set(chunk.chunkIndex, decodeBase64ToBytes(chunk.dataBase64))
    } else if (resolvedType === 'normalized') {
      callbacks?.onNormalized?.(payload as ParseNormalizedEvent)
    } else if (resolvedType === terminal) {
      completedResult = payload as T
    } else if (resolvedType === 'failed') {
      const fail = payload as ParseFailedEvent
      streamFailedError = new Error(fail.message || `解析失败 (${fail.code || 'ERROR'})`)
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        if (block.trim()) processEventBlock(block)
        if (streamFailedError) throw streamFailedError
      }
    }
    if (buffer.trim()) {
      processEventBlock(buffer)
      if (streamFailedError) throw streamFailedError
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }

  if (streamFailedError) {
    throw streamFailedError
  }

  if (!completedResult) {
    throw new Error('解析连接意外中断，未收到完成事件。可从本地草稿重新提交。')
  }

  const finalResult: T = completedResult
  const expected = requiredAssets(finalResult)
  const mimeMap = new Map(expected.map((asset) => [asset.assetId, asset.mimeType]))

  const assets = new Map<string, Blob>()
  for (const [assetId, bucket] of chunkBuckets.entries()) {
    if (bucket.parts.size !== bucket.chunkCount) {
      throw new Error(`配图资源 ${assetId} 分片不完整 (${bucket.parts.size}/${bucket.chunkCount})`)
    }
    const orderedParts: BlobPart[] = []
    for (let i = 0; i < bucket.chunkCount; i++) {
      const part = bucket.parts.get(i)
      if (!part) throw new Error(`配图资源 ${assetId} 缺少分片 #${i}`)
      orderedParts.push(
        part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer,
      )
    }
    const mimeType = mimeMap.get(assetId) ?? 'image/png'
    assets.set(assetId, new Blob(orderedParts, { type: mimeType }))
  }

  // Validate required assets exist
  for (const asset of expected) {
    if (!assets.has(asset.assetId)) {
      throw new Error(`缺少答题卡配图资源 ${asset.assetId}`)
    }
  }

  return {
    result: finalResult,
    assets,
  }
}

export async function reviewQuestionGroupApi(
  input: QuestionReviewInput,
  images: ReadonlyMap<string, Blob>,
  signal?: AbortSignal,
): Promise<QuestionReviewResult> {
  const formData = new FormData()
  formData.append('payload', JSON.stringify(input))
  for (const [partName, blob] of images.entries()) {
    formData.append(partName, blob, `${partName}.png`)
  }
  const response = await fetch('/api/v1/answer-sheet/questions/review', {
    method: 'POST',
    headers: getAnswerSheetAuthHeaders(),
    body: formData,
    signal,
  })
  if (!response.ok) {
    throw new Error(`大题复审请求失败 (HTTP ${response.status})`)
  }
  return (await response.json()) as QuestionReviewResult
}

export async function reparseQuestionGroupApi(
  input: QuestionReparseInput,
  images: ReadonlyMap<string, Blob>,
  signal?: AbortSignal,
): Promise<QuestionReparseResult> {
  const formData = new FormData()
  formData.append('payload', JSON.stringify(input))
  for (const [partName, blob] of images.entries()) {
    formData.append(partName, blob, `${partName}.png`)
  }
  const response = await fetch('/api/v1/answer-sheet/questions/reparse', {
    method: 'POST',
    headers: getAnswerSheetAuthHeaders(),
    body: formData,
    signal,
  })
  if (!response.ok) {
    throw new Error(`大题返修请求失败 (HTTP ${response.status})`)
  }
  return (await response.json()) as QuestionReparseResult
}
