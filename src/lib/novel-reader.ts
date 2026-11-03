import type { ChapterLink, Novel } from '@/api/novels'

export type ReadingMode = 'target' | 'source' | 'parallel'
export type ChapterReadingHistory = Record<string, number>
export interface ReadingProgress {
  chapterId: string
  chapterNo: number
  scroll: number
  anchors?: Partial<Record<'source' | 'target', number>>
  fraction?: number
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readStored<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as T | null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

export function progressKey(novelId: string) {
  return `novel-progress:${novelId}`
}

export function readProgress(novelId: string): ReadingProgress | null {
  const value = readStored<ReadingProgress>(progressKey(novelId))
  return value &&
    uuidPattern.test(value.chapterId) &&
    Number.isInteger(value.chapterNo) &&
    typeof value.scroll === 'number' &&
    Number.isFinite(value.scroll) &&
    value.scroll >= 0
    ? {
        chapterId: value.chapterId,
        chapterNo: value.chapterNo,
        scroll: value.scroll,
        anchors: Object.fromEntries(
          (['source', 'target'] as const)
            .filter((key) => Number.isInteger(value.anchors?.[key]) && value.anchors![key]! >= 0)
            .map((key) => [key, value.anchors![key]]),
        ),
        fraction:
          typeof value.fraction === 'number' && Number.isFinite(value.fraction)
            ? Math.max(0, Math.min(1, value.fraction))
            : undefined,
      }
    : null
}

export function chapterHistoryKey(novelId: string) {
  return `novel-chapter-history:${novelId}`
}

export function readChapterHistory(novelId: string): ChapterReadingHistory {
  const stored = readStored<unknown>(chapterHistoryKey(novelId))
  const history: ChapterReadingHistory = Object.fromEntries(
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? Object.entries(stored).filter(
          ([id, fraction]) =>
            uuidPattern.test(id) &&
            typeof fraction === 'number' &&
            Number.isFinite(fraction) &&
            fraction >= 0 &&
            fraction <= 1,
        )
      : [],
  )
  const progress = readProgress(novelId)
  if (stored === null && progress?.fraction !== undefined)
    history[progress.chapterId] = Math.max(history[progress.chapterId] ?? 0, progress.fraction)
  return history
}

export function chapterReadingStatus(fraction: number | undefined): string {
  if (fraction === undefined) return '未读'
  if (fraction >= 1) return '已读完'
  return `已读 ${Math.min(99, Math.round(fraction * 100))}%`
}

export function novelTitle(novel: Novel): string {
  return novel.target_title?.trim() || novel.title.trim()
}

export function novelOriginalTitle(novel: Novel): string {
  const source = novel.title.trim()
  return source !== novelTitle(novel) ? source : ''
}

export function chapterTitle(chapter: ChapterLink, mode: ReadingMode = 'target'): string {
  const title = mode === 'source' ? chapter.source_title : chapter.target_title
  return (
    title?.trim() ||
    (mode === 'source' ? chapter.target_title : chapter.source_title)?.trim() ||
    `第 ${chapter.chapter_no} 章`
  )
}

export function chapterPath(novelId: string, chapterId: string) {
  return `/novels/${encodeURIComponent(novelId)}/chapters/${encodeURIComponent(chapterId)}`
}
