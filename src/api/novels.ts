import { getApiBaseUrl } from './index'
import { cachedRequest } from '@/lib/request-cache'

export const NOVEL_DATA_TTL = 5 * 60 * 1000
export const CHAPTER_DATA_TTL = 30 * 60 * 1000

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface Novel {
  id: string
  title: string
  target_title: string | null
  source_language: string
  created_at: string
  chapter_count: number
  translated_count: number
  first_chapter_id: string | null
}

export interface ChapterLink {
  id: string
  chapter_no: number
  source_title: string | null
  target_title: string | null
}

export interface ChapterItem extends ChapterLink {
  has_source: boolean
  has_target: boolean
}

export interface Chapter extends ChapterLink {
  novel_id: string
  source_content: string | null
  target_content: string | null
  previous: ChapterLink | null
  next: ChapterLink | null
}

export interface Entity {
  id: string
  kind: string
  source_name: string
  target_name: string | null
  description: string | null
  attributes: Record<string, unknown>
  first_seen_chapter_id: string | null
  first_seen_chapter_no: number | null
}

export interface Relationship {
  id: string
  subject_entity_id: string
  object_entity_id: string
  predicate: string
  description: string | null
  subject_source_name: string
  subject_target_name: string | null
  object_source_name: string
  object_target_name: string | null
  start_chapter_id: string | null
  end_chapter_id: string | null
  start_chapter_no: number | null
  end_chapter_no: number | null
}

function request<T>(
  path: string,
  signal?: AbortSignal,
  refresh = false,
  ttl = NOVEL_DATA_TTL,
): Promise<T> {
  const url = `${getApiBaseUrl()}/novels${path}`
  return cachedRequest(
    url,
    async (requestSignal) => {
      const response = await fetch(url, {
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.any([requestSignal, AbortSignal.timeout(12000)]),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(
          body?.error ||
            (response.status === 404 ? '小说或章节不存在。' : '小说服务暂时不可用，请重试。'),
        )
      }
      return response.json() as Promise<T>
    },
    { signal, refresh, ttl },
  )
}

export function errorMessage(error: unknown) {
  return error instanceof Error && error.name === 'Error'
    ? error.message
    : '加载失败，请检查网络后重试。'
}

export const novelApi = {
  list: (page: number, q: string, signal?: AbortSignal, refresh = false) =>
    request<PageResult<Novel>>(
      `?${new URLSearchParams({ page: String(page), limit: '20', q })}`,
      signal,
      refresh,
    ),
  detail: (id: string, signal?: AbortSignal, refresh = false) =>
    request<Novel>(`/${encodeURIComponent(id)}`, signal, refresh),
  chapters: (id: string, page: number, signal?: AbortSignal, refresh = false) =>
    request<PageResult<ChapterItem>>(
      `/${encodeURIComponent(id)}/chapters?page=${page}&limit=100`,
      signal,
      refresh,
    ),
  chapter: (novelId: string, chapterId: string, signal?: AbortSignal, refresh = false) =>
    request<Chapter>(
      `/${encodeURIComponent(novelId)}/chapters/${encodeURIComponent(chapterId)}`,
      signal,
      refresh,
      CHAPTER_DATA_TTL,
    ),
  entities: (id: string, page: number, signal?: AbortSignal, refresh = false) =>
    request<PageResult<Entity>>(
      `/${encodeURIComponent(id)}/entities?page=${page}&limit=30`,
      signal,
      refresh,
    ),
  relationships: (id: string, page: number, signal?: AbortSignal, refresh = false) =>
    request<PageResult<Relationship>>(
      `/${encodeURIComponent(id)}/relationships?page=${page}&limit=30`,
      signal,
      refresh,
    ),
}
