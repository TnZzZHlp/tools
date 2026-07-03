export type OcrOutputMode = 'text' | 'markdown'

export interface OcrChatCompletionsRequest {
  model: string
  fileUrl: string
  optionalPayload: {
    useDocOrientationClassify: false
    useDocUnwarping: false
    useChartRecognition?: false
    useTextlineOrientation?: false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function buildOcrChatCompletionsRequest(
  fileUrl: string,
  outputMode: OcrOutputMode,
): OcrChatCompletionsRequest {
  return {
    model: outputMode === 'markdown' ? 'PaddleOCR-VL-1.6' : 'PP-OCRv6',
    fileUrl,
    optionalPayload:
      outputMode === 'markdown'
        ? {
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false,
          }
        : {
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useTextlineOrientation: false,
          },
  }
}

export function extractChatCompletionText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return ''

  const firstChoice = value.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return ''

  const content = firstChoice.message.content
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .filter(isRecord)
    .map((part) => (part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}
