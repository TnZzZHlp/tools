const STORAGE_KEY = 'tools:answer-sheet:access-key'

export const ANSWER_SHEET_ACCESS_KEY_HEADER = 'X-Answer-Sheet-Key'

export function getAnswerSheetAccessKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setAnswerSheetAccessKey(key: string): string {
  const trimmed = key.trim()
  if (typeof window !== 'undefined') {
    try {
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEY, trimmed)
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Ignore storage failures
    }
  }
  return trimmed
}

export function clearAnswerSheetAccessKey(): void {
  setAnswerSheetAccessKey('')
}

export function extractPwParam(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) {
    const first = raw.find((item): item is string => typeof item === 'string' && item.trim() !== '')
    return first?.trim() ?? ''
  }
  return ''
}

export function getAnswerSheetAuthHeaders(overrideKey?: string): Record<string, string> {
  const key = (overrideKey ?? getAnswerSheetAccessKey()).trim()
  return key ? { [ANSWER_SHEET_ACCESS_KEY_HEADER]: key } : {}
}

export interface VerifyAuthResult {
  authorized: boolean
  status: number
  message?: string
}

export async function verifyAnswerSheetAccessKey(overrideKey?: string): Promise<VerifyAuthResult> {
  const key = (overrideKey ?? getAnswerSheetAccessKey()).trim()
  try {
    const response = await fetch('/api/v1/answer-sheet/auth/verify', {
      method: 'GET',
      headers: getAnswerSheetAuthHeaders(key),
    })
    if (response.ok) {
      return { authorized: true, status: response.status }
    }
    if (response.status === 401) {
      let message = '缺少或无效的答题卡授权码。'
      try {
        const body = (await response.json()) as { message?: string; error?: string }
        message = body.message ?? body.error ?? message
      } catch {
        // use default
      }
      return { authorized: false, status: 401, message }
    }
    // Non-401 (e.g. backend offline / dev proxy missing) -> don't hard-lock local offline viewing
    return { authorized: true, status: response.status }
  } catch {
    return { authorized: true, status: 0 }
  }
}
