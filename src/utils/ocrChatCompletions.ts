export type OcrOutputMode = 'text' | 'markdown'

interface ChatCompletionTextPart {
  type: 'text'
  text: string
}

interface ChatCompletionImagePart {
  type: 'image_url'
  image_url: {
    url: string
  }
}

export interface OcrChatCompletionsRequest {
  model: string
  messages: Array<{
    role: 'user'
    content: Array<ChatCompletionTextPart | ChatCompletionImagePart>
  }>
  stream: false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function buildOcrChatCompletionsRequest(
  imageDataUrl: string,
  outputMode: OcrOutputMode,
): OcrChatCompletionsRequest {
  const prompt =
    outputMode === 'markdown'
      ? '识别图片中的全部内容，保留标题、段落、表格和公式结构，仅返回 Markdown。'
      : '识别图片中的全部文字，保持自然阅读顺序，仅返回纯文本。'

  return {
    model: outputMode === 'markdown' ? 'PaddleOCR-VL-1.6' : 'PP-OCRv6',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    stream: false,
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

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('无法读取图片内容'))
    })
    reader.addEventListener('error', () => reject(new Error('无法读取图片内容')))
    reader.readAsDataURL(file)
  })
}
