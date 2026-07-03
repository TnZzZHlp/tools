import { describe, expect, it } from 'vitest'

import {
  buildOcrChatCompletionsRequest,
  extractChatCompletionText,
} from '@/utils/ocrChatCompletions'

describe('OCR Chat Completions helpers', () => {
  it('builds an OpenAI-style multimodal request body', () => {
    const request = buildOcrChatCompletionsRequest('data:image/png;base64,abc', 'markdown')

    expect(request).toMatchObject({
      model: 'PaddleOCR-VL-1.6',
      stream: false,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc' },
            },
          ],
        },
      ],
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
