import { describe, expect, it } from 'vitest'

import { parseTracingMacro } from '@/utils/parseTracingMacro'

describe('parseTracingMacro', () => {
  it('parses the provided debug example into a LogQL template', () => {
    const result = parseTracingMacro(`debug!(
      manga_name = manga.name,
      parsed_count = parsed_chapters.len(),
      skipped_count = skipped_count,
      "Search complete for manga, no new chapters"
    );`)

    expect(result.ok).toBe(true)
    expect(result.error).toBeNull()
    expect(result.data?.template).toBe(
      '{{.message}} manga_name={{.manga_name}} parsed_count={{.parsed_count}} skipped_count={{.skipped_count}}',
    )
    expect(result.data?.fields.map((field) => field.key)).toEqual([
      'manga_name',
      'parsed_count',
      'skipped_count',
    ])
    expect(result.data?.message).toBe('Search complete for manga, no new chapters')
  })

  it('supports other tracing macro levels', () => {
    const result = parseTracingMacro('info!(user_id = user.id, success = true, "done");')

    expect(result.ok).toBe(true)
    expect(result.data?.macroName).toBe('info')
    expect(result.data?.template).toBe('{{.message}} user_id={{.user_id}} success={{.success}}')
  })

  it('allows macros without a trailing message literal', () => {
    const result = parseTracingMacro('warn!(user_id = user.id, retry_count = retries.len());')

    expect(result.ok).toBe(true)
    expect(result.data?.message).toBeNull()
    expect(result.data?.template).toBe('user_id={{.user_id}} retry_count={{.retry_count}}')
  })

  it('keeps nested expressions intact while extracting field names', () => {
    const result = parseTracingMacro(
      'trace!(payload = format!("{}:{}", user.id, user.name), status = response[0], "sent");',
    )

    expect(result.ok).toBe(true)
    expect(result.data?.fields).toEqual([
      { key: 'payload', expression: 'format!("{}:{}", user.id, user.name)' },
      { key: 'status', expression: 'response[0]' },
    ])
  })

  it('returns a readable error for unsupported shorthand fields', () => {
    const result = parseTracingMacro('debug!(user_id, "done");')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('暂不支持解析这一项')
  })
})
