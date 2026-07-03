import { describe, expect, it } from 'vitest'

import {
  buildOcrChatCompletionsRequest,
  extractChatCompletionText,
} from '@/utils/ocrChatCompletions'

describe('OCR Chat Completions helpers', () => {
  it('builds a URL-based JSON request body', () => {
    const request = buildOcrChatCompletionsRequest('https://example.com/image.jpg', 'markdown')

    expect(request).toEqual({
      model: 'PaddleOCR-VL-1.6',
      fileUrl: 'https://example.com/image.jpg',
      optionalPayload: {
        useDocOrientationClassify: false,
        useDocUnwarping: false,
        useChartRecognition: false,
      },
    })
  })

  it('extracts string content from a Chat Completions response', () => {
    expect(
      extractChatCompletionText({
        choices: [{ message: { role: 'assistant', content: ' recognized text ' } }],
      }),
    ).toBe('recognized text')
  })

  it('extracts text parts from a multimodal response', () => {
    expect(
      extractChatCompletionText({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'first' },
                { type: 'image_url', image_url: { url: 'ignored' } },
                { type: 'text', text: 'second' },
              ],
            },
          },
        ],
      }),
    ).toBe('first\nsecond')
  })
})
