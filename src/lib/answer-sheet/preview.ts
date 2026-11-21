import chinese from './mocks/chinese.json'
import english from './mocks/english.json'
import physics from './mocks/physics.json'
import weekend from './mocks/weekend-chinese.json'
import diagram from './mocks/IMG_01.svg?url'
import diagramRaw from './mocks/IMG_01.svg?raw'
import type { DraftQuestionReview } from './draft'
import type { QuestionGroup } from './review'
import type { AnswerSheetBlock, AnswerSheetSemanticData, SubjectType } from './types'

export type PreviewSampleKey = 'weekend' | 'chinese' | 'english' | 'physics'

export const previewSamples = { weekend, chinese, english, physics } as Record<
  PreviewSampleKey,
  AnswerSheetSemanticData
>
export const previewAssets: Record<string, string> = { IMG_01: diagram }
export const previewAssetBlobs: Record<string, () => Blob> = {
  IMG_01: () => new Blob([diagramRaw], { type: 'image/svg+xml' }),
}

export const SUBJECT_LABELS: Record<SubjectType, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  politics: '政治',
  history: '历史',
  geography: '地理',
}

export const BLOCK_TYPE_LABELS: Record<AnswerSheetBlock['type'], string> = {
  omr_choice: '客观选择题',
  compact_blank: '紧凑填空网格',
  mixed_inline: '混合行内填空与简答',
  open_blank_box: '纯空白解答框',
  lined_writing: '横线写作区',
  composition_grid: '语文作文方格区',
  drawing_grid: '作图与坐标纸区',
}

export function buildQuestionGroupsFromBlocks(blocks: AnswerSheetBlock[]): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  const sorted = [...blocks].sort((a, b) => a.numericOrder - b.numericOrder)

  let choiceBucket: AnswerSheetBlock[] = []
  let choiceTag: string | undefined

  const flushChoiceGroup = () => {
    if (!choiceBucket.length) return
    const first = choiceBucket[0]!
    const last = choiceBucket[choiceBucket.length - 1]!
    const displayNo =
      choiceBucket.length === 1 ? first.displayNo : `${first.displayNo}~${last.displayNo}`
    const groupId = `group-choice-${first.id}`
    groups.push({
      groupId,
      displayNo: choiceTag ? `${choiceTag} (${displayNo})` : `选择题 (${displayNo})`,
      sourceMarkdown: `客观选择题第 ${displayNo} 题`,
      sourceAssetIds: [],
      blockIds: choiceBucket.map((b) => b.id),
    })
    choiceBucket = []
  }

  for (const block of sorted) {
    if (block.type === 'omr_choice') {
      if (choiceBucket.length > 0 && block.groupTag !== choiceTag) {
        flushChoiceGroup()
      }
      choiceTag = block.groupTag
      choiceBucket.push(block)
      continue
    }
    flushChoiceGroup()

    const sourceAssets: string[] = []
    if (block.type === 'open_blank_box' && block.attachedAssetIds) {
      for (const a of block.attachedAssetIds) sourceAssets.push(a.assetId)
    } else if (block.type === 'drawing_grid' && block.assetId) {
      sourceAssets.push(block.assetId)
    } else if (block.type === 'mixed_inline') {
      for (const r of block.rows) {
        if (r.type === 'embedded_image') sourceAssets.push(r.assetId)
      }
    }

    groups.push({
      groupId: `group-${block.id}`,
      displayNo: `第 ${block.displayNo} 题`,
      sourceMarkdown: `${block.sectionTitle ? `【${block.sectionTitle}】` : ''}第 ${block.displayNo} 题（${block.score ?? 0} 分）`,
      sourceAssetIds: sourceAssets,
      blockIds: [block.id],
    })
  }
  flushChoiceGroup()

  return groups
}

export function buildSampleReviews(
  groups: QuestionGroup[],
  blocks: AnswerSheetBlock[],
  computeRevision: (group: QuestionGroup) => string,
): Record<string, DraftQuestionReview> {
  const blockMap = new Map(blocks.map((b) => [b.id, b]))
  const reviews: Record<string, DraftQuestionReview> = {}

  for (const [idx, group] of groups.entries()) {
    const rev = computeRevision(group)
    const firstBlockId = group.blockIds[0]
    const firstBlock = firstBlockId ? blockMap.get(firstBlockId) : undefined

    if (firstBlock && firstBlock.type === 'lined_writing' && idx === 1) {
      reviews[group.groupId] = {
        revision: rev,
        status: 'needs_revision',
        automaticRepairCount: 1,
        history: [
          {
            groupId: group.groupId,
            revision: rev,
            verdict: 'needs_revision',
            issues: [
              {
                kind: 'layout',
                blockId: firstBlock.id,
                subNo: firstBlock.subItems?.[0]?.label,
                evidence: `第 ${firstBlock.displayNo} 题当前基准行数 ${firstBlock.baseLines} 行（单行高 8.0mm），对照分值（${firstBlock.score ?? 4} 分）与审题要点略显紧凑`,
                suggestion: '建议增加 1~2 行手写横线或适当调大行高，预留充裕书写空间。',
              },
            ],
          },
        ],
      }
    } else {
      reviews[group.groupId] = {
        revision: rev,
        status: 'passed',
        automaticRepairCount: 0,
        history: [
          {
            groupId: group.groupId,
            revision: rev,
            verdict: 'passed',
            issues: [],
          },
        ],
      }
    }
  }
  return reviews
}
