import type { ParsedQuestionEvent } from './api'
import type { QuestionSourceImage } from './review'
import type { SheetMeta } from './types'

export interface OcrPage {
  page: number
  markdown: string
  sourceImages: QuestionSourceImage[]
}

export interface SplitQuestion {
  groupId: string
  displayNo: string
  startLine: number
  endLine: number
  sharedLines: [number, number] | null
  needsReview: boolean
}

export interface SplitPaperResult {
  meta: SheetMeta
  questions: SplitQuestion[]
}

export type PdfCheckpoint =
  | { type: 'page'; result: OcrPage; assets: Map<string, Blob> }
  | { type: 'question'; subject: SheetMeta['subject']; result: ParsedQuestionEvent }
