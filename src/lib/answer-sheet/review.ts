import type {
  AnswerSheetBlock,
  AnswerSheetSemanticData,
  PaperSize,
  PaperSpecId,
  SheetAsset,
  SubjectType,
} from './types'

export interface QuestionGroup {
  groupId: string
  displayNo: string
  sourceMarkdown: string
  sourceAssetIds: string[]
  blockIds: string[]
}

export interface WritingLineMeasurement {
  heightMm: number
  writableWidthMm: number
}

export type WritableAreaMeasurement = {
  blockId: string
  subNo?: string
} & (
  | { type: 'writing_lines'; lines: WritingLineMeasurement[] }
  | ({ type: 'blank_box' | 'drawing_area' } & PaperSize)
  | { type: 'composition_grid'; gridCount: number; cellWidthMm: number; cellHeightMm: number }
)

export interface QuestionRenderFragment {
  pageIndex: number
  columnIndex: number
  fragmentIndex: number
  imagePart: string
  areas: WritableAreaMeasurement[]
}

export interface QuestionSourceImage {
  assetId: string
  mimeType: string
  widthPx: number
  heightPx: number
}

export interface AnswerSheetParseResult {
  semanticData: AnswerSheetSemanticData
  questionGroups: QuestionGroup[]
  sourceImages: QuestionSourceImage[]
}

export interface ReviewSourceImage extends QuestionSourceImage {
  imagePart: string
}

export interface QuestionRequestContext {
  group: QuestionGroup
  subject: SubjectType
  revision: string
  blocks: AnswerSheetBlock[]
  sourceImages: ReviewSourceImage[]
}

export interface QuestionReviewInput extends QuestionRequestContext {
  paperSpec: PaperSpecId
  paperSize: PaperSize
  fragmentCount: number
  fragments: QuestionRenderFragment[]
}

export interface QuestionReviewIssue {
  kind: 'semantic' | 'layout'
  blockId?: string
  subNo?: string
  evidence: string
  suggestion: string
}

export interface QuestionReviewResult {
  groupId: string
  revision: string
  verdict: 'passed' | 'needs_revision' | 'uncertain'
  issues: QuestionReviewIssue[]
}

export interface QuestionReparseInput extends QuestionRequestContext {
  issues: QuestionReviewIssue[]
}

export interface QuestionReparseResult {
  groupId: string
  revision: string
  blocks: AnswerSheetBlock[]
  assets: SheetAsset[]
}
