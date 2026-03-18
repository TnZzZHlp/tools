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
      '| json | line_format "{{$hasContent := false}}{{ with .message }}{{ . }}{{$hasContent = true}}{{ end }}{{ with .manga_name }}{{ if $hasContent }} {{ end }}manga_name={{ . }}{{$hasContent = true}}{{ end }}{{ with .parsed_count }}{{ if $hasContent }} {{ end }}parsed_count={{ . }}{{$hasContent = true}}{{ end }}{{ with .skipped_count }}{{ if $hasContent }} {{ end }}skipped_count={{ . }}{{$hasContent = true}}{{ end }}"',
    )
    expect(result.data?.macros[0]?.fields.map((field) => field.key)).toEqual([
      'manga_name',
      'parsed_count',
      'skipped_count',
    ])
    expect(result.data?.macros[0]?.message).toBe('Search complete for manga, no new chapters')
  })

  it('supports other tracing macro levels', () => {
    const result = parseTracingMacro('info!(user_id = user.id, success = true, "done");')

    expect(result.ok).toBe(true)
    expect(result.data?.macros[0]?.macroName).toBe('info')
    expect(result.data?.template).toBe(
      '| json | line_format "{{$hasContent := false}}{{ with .message }}{{ . }}{{$hasContent = true}}{{ end }}{{ with .user_id }}{{ if $hasContent }} {{ end }}user_id={{ . }}{{$hasContent = true}}{{ end }}{{ with .success }}{{ if $hasContent }} {{ end }}success={{ . }}{{$hasContent = true}}{{ end }}"',
    )
  })

  it('allows macros without a trailing message literal', () => {
    const result = parseTracingMacro('warn!(user_id = user.id, retry_count = retries.len());')

    expect(result.ok).toBe(true)
    expect(result.data?.macros[0]?.message).toBeNull()
    expect(result.data?.template).toBe(
      '| json | line_format "{{$hasContent := false}}{{ with .user_id }}{{ if $hasContent }} {{ end }}user_id={{ . }}{{$hasContent = true}}{{ end }}{{ with .retry_count }}{{ if $hasContent }} {{ end }}retry_count={{ . }}{{$hasContent = true}}{{ end }}"',
    )
  })

  it('keeps nested expressions intact while extracting field names', () => {
    const result = parseTracingMacro(
      'trace!(payload = format!("{}:{}", user.id, user.name), status = response[0], "sent");',
    )

    expect(result.ok).toBe(true)
    expect(result.data?.macros[0]?.fields).toEqual([
      { key: 'payload', expression: 'format!("{}:{}", user.id, user.name)' },
      { key: 'status', expression: 'response[0]' },
    ])
  })

  it('supports parsing multiple tracing macros and deduplicates repeated fields globally', () => {
    const result =
      parseTracingMacro(`info!(image_index = image.index, path = ?image_path, "Downloaded image");
info!(image_index = image.index, path = ?image_path, "Skipped existing image");
warn!(image_index = image.index, error = %e, "Failed to download image");`)

    expect(result.ok).toBe(true)
    expect(result.data?.macros).toHaveLength(3)
    expect(result.data?.template).toBe(
      '| json | line_format "{{$hasContent := false}}{{ with .message }}{{ . }}{{$hasContent = true}}{{ end }}{{ with .image_index }}{{ if $hasContent }} {{ end }}image_index={{ . }}{{$hasContent = true}}{{ end }}{{ with .path }}{{ if $hasContent }} {{ end }}path={{ . }}{{$hasContent = true}}{{ end }}{{ with .error }}{{ if $hasContent }} {{ end }}error={{ . }}{{$hasContent = true}}{{ end }}"',
    )
  })

  it('returns a readable error for unsupported shorthand fields', () => {
    const result = parseTracingMacro('debug!(user_id, "done");')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('暂不支持解析这一项')
  })
})
