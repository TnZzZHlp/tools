export type SubjectType =
  | 'chinese'
  | 'math'
  | 'english'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'politics'
  | 'history'
  | 'geography'

export type PaperSpecId = 'A3_2COL' | 'A3_3COL' | '8K_2COL' | '8K_B4_2COL' | 'A4_1COL'

export type HeaderMode = 'barcode' | 'id_grid'

export type AssetUsage = 'drawable' | 'reference'

export type AssetPosition = 'top-right' | 'top-left' | 'bottom'

export type GridType = 'coordinate_paper' | 'image_canvas'

export type IssueSeverity = 'error' | 'warning' | 'info'

export type DensityPreset = 'loose' | 'normal' | 'compact'

export interface SheetMeta {
  title: string
  subtitle?: string
  subject: SubjectType
  totalScore: number
  recommendedPaperSpec: PaperSpecId
  studentFields: string[]
  headerMode: HeaderMode
}

export interface SheetAsset {
  assetId: string
  mimeType: string
  widthPx: number
  heightPx: number
  usageType: AssetUsage
  monochromeRecommended: boolean
}

export interface BlockBase {
  id: string
  displayNo: string
  numericOrder: number
  sectionTitle?: string
  score?: number
}

export interface CompactBlankItem {
  subNo: string
  score?: number
  prefixLatex?: string
  suffixUnit?: string
  minWidthWeight?: number
}

export interface InlineBlankSegment {
  label: string
  score?: number
  blanksCount: number
  prefix?: string
  suffixUnit?: string
  separator?: string
}

export interface SubQuestion {
  subNo: string
  score?: number
  heightRatio?: number
}

export interface AttachedAsset {
  assetId: string
  position: AssetPosition
}

export interface WritingItem {
  label: string
  score?: number
  baseLines: number
  estimatedChars?: number
}

export interface ContinuationParagraph {
  heading: string
  leadText: string
  baseLines: number
}

export interface EnglishWritingMeta {
  salutation?: string
  signOff?: string
  continuationParagraphs?: ContinuationParagraph[]
}

export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
  relatedBlockId?: string
}

export interface ValidationReport {
  passed: boolean
  calculatedScore: number
  issues: ValidationIssue[]
}

export interface AnswerSheetSemanticData {
  meta: SheetMeta
  assets: SheetAsset[]
  blocks: AnswerSheetBlock[]
  validation: ValidationReport
}

export interface PaperSize {
  widthMm: number
  heightMm: number
}

export interface BlockOverride {
  manualLines?: number
  manualHeightMm?: number
  forceBreakBefore?: boolean
  imageWidthMm?: number
  monochrome?: boolean
}

export interface PaperOverrides {
  globalLineHeightMm?: number
  blockOverrides: Record<string, BlockOverride>
}

export interface AnswerSheetLayoutConfig {
  activePaperSpec: PaperSpecId
  customPaperSize?: PaperSize
  densityPreset: DensityPreset
  showBoundaryWarning?: boolean
  defaultCompositionWords?: number
  defaultCompositionCols?: number
  resolvedIssueKeys?: string[]
  perPaperOverrides: Record<PaperSpecId, PaperOverrides>
}

export type RowType = 'inline_blank' | 'full_line' | 'embedded_image'

export type MixedInlineRow =
  | {
      type: 'inline_blank'
      segments: InlineBlankSegment[]
    }
  | {
      type: 'full_line'
      label?: string
      lines: number
      estimatedChars?: number
    }
  | {
      type: 'embedded_image'
      assetId: string
      widthRatio?: number
    }

export type BlockType =
  | 'omr_choice'
  | 'compact_blank'
  | 'mixed_inline'
  | 'open_blank_box'
  | 'lined_writing'
  | 'composition_grid'
  | 'drawing_grid'

export type AnswerSheetBlock =
  | (BlockBase & {
      type: 'omr_choice'
      options: string[]
      isMultiple: boolean
      maxSelectCount?: number
      groupTag?: string
    })
  | (BlockBase & {
      type: 'compact_blank'
      items: CompactBlankItem[]
      preferredColumns: number
    })
  | (BlockBase & {
      type: 'mixed_inline'
      rows: MixedInlineRow[]
    })
  | (BlockBase & {
      type: 'open_blank_box'
      baseHeightMm: number
      subQuestions?: SubQuestion[]
      attachedAssetIds?: AttachedAsset[]
    })
  | (BlockBase & {
      type: 'lined_writing'
      estimatedChars?: number
      baseLines: number
      subItems?: WritingItem[]
      englishWritingMeta?: EnglishWritingMeta
    })
  | (BlockBase & {
      type: 'composition_grid'
      minWords: number
      totalGrids: number
      hasTitleRow: boolean
      milestones: number[]
    })
  | (BlockBase & {
      type: 'drawing_grid'
      gridType: GridType
      rows?: number
      cols?: number
      assetId?: string
      baseHeightMm: number
    })
