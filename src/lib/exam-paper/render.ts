import {
  DIFFICULTY_LEVELS,
  type CompoundQuestionItem,
  type ExamDocument,
  type GroupChildQuestion,
  type GroupDelimiterStyle,
  type QuestionOption,
  type StandardQuestionItem,
} from './types'

export type RenderedParagraphRole =
  | 'title'
  | 'section-header'
  | 'group-delimiter'
  | 'group-passage'
  | 'question-stem'
  | 'sub-question-stem'
  | 'option'
  | 'tag'
  | 'tag-header'
  | 'sub-answer'
  | 'sub-analysis'
  | 'continuation'

export interface RenderedParagraph {
  role: RenderedParagraphRole
  text: string
  prefix?: string
  body?: string
  sectionId?: string
  itemId?: string
  childId?: string
  questionNumber?: number
}

export interface PaperNumbering {
  questionNumbers: Map<string, number>
  groupIndexes: Map<string, number>
}

export interface PaperStats {
  sectionCount: number
  questionCount: number
  subQuestionCount: number
  groupCount: number
  scoredQuestionCount: number
  totalScore: number
  allScored: boolean
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  sectionId?: string
  itemId?: string
  childId?: string
}

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

export function toChineseNumeral(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return String(n)
  if (n < 10) return CHINESE_DIGITS[n] ?? String(n)
  if (n === 10) return '十'
  if (n < 20) return `十${CHINESE_DIGITS[n % 10] ?? ''}`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    const tensChar = CHINESE_DIGITS[tens] ?? ''
    const onesChar = ones > 0 ? (CHINESE_DIGITS[ones] ?? '') : ''
    return `${tensChar}十${onesChar}`
  }
  return String(n)
}

export function formatGroupDelimiter(style: GroupDelimiterStyle, index1Based: number): string {
  const safeIndex = Math.max(1, Math.floor(index1Based))
  if (style === 'chinese-section') {
    return `第${toChineseNumeral(safeIndex)}节`
  }
  if (style === 'uppercase-letter') {
    if (safeIndex <= 26) {
      return String.fromCharCode(64 + safeIndex)
    }
    const first = Math.floor((safeIndex - 1) / 26)
    const second = ((safeIndex - 1) % 26) + 1
    return `${String.fromCharCode(64 + first)}${String.fromCharCode(64 + second)}`
  }
  return `（${toChineseNumeral(safeIndex)}）`
}

export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return ''
  const rounded = Math.round(score * 100) / 100
  return String(rounded)
}

export function normalizeKnowledgePoints(raw: string): string {
  return raw
    .split(/[；;、,，\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('；')
}

export function computePaperNumbering(doc: ExamDocument): PaperNumbering {
  const questionNumbers = new Map<string, number>()
  const groupIndexes = new Map<string, number>()
  let nextQuestionNumber = 1

  for (const section of doc.sections) {
    let nextGroupIndex = 1
    for (const item of section.items) {
      if (item.kind === 'group') {
        groupIndexes.set(item.id, nextGroupIndex)
        nextGroupIndex += 1
        for (const child of item.questions) {
          questionNumbers.set(child.id, nextQuestionNumber)
          nextQuestionNumber += 1
        }
      } else {
        questionNumbers.set(item.id, nextQuestionNumber)
        nextQuestionNumber += 1
      }
    }
  }

  return { questionNumbers, groupIndexes }
}

function splitTrimmedLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n').map((line) => line.replace(/\s+$/g, ''))
  while (lines.length > 0 && lines[0] === '') {
    lines.shift()
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}

function formatOptionLines(options: QuestionOption[]): string[] {
  return options
    .map((opt) => ({
      label: opt.label.trim(),
      text: opt.text.trim(),
    }))
    .filter((opt) => opt.label.length > 0 && opt.text.length > 0)
    .map((opt) => `${opt.label}.${opt.text}`)
}

function pushTaggedBlock(
  out: RenderedParagraph[],
  tagName: string,
  content: string,
  sectionId: string,
  itemId: string,
  questionNumber?: number,
  childId?: string,
) {
  const lines = splitTrimmedLines(content)
  const first = lines[0]
  if (first === undefined) return
  out.push({
    role: 'tag',
    text: `${tagName}${first}`,
    prefix: tagName,
    body: first,
    sectionId,
    itemId,
    childId,
    questionNumber,
  })
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line !== undefined) {
      out.push({
        role: 'continuation',
        text: line,
        sectionId,
        itemId,
        childId,
        questionNumber,
      })
    }
  }
}

function pushQuestionSteps(
  out: RenderedParagraph[],
  steps: string[],
  sectionId: string,
  itemId: string,
  questionNumber?: number,
  childId?: string,
) {
  const nonEmptySteps = steps
    .map((step) => splitTrimmedLines(step))
    .filter((lines) => lines.length > 0)

  for (let idx = 0; idx < nonEmptySteps.length; idx += 1) {
    const lines = nonEmptySteps[idx]
    if (!lines) continue
    const first = lines[0] ?? ''
    const tagPrefix = `【步骤${idx + 1}】`
    out.push({
      role: 'tag',
      text: `${tagPrefix}${first}`,
      prefix: tagPrefix,
      body: first,
      sectionId,
      itemId,
      childId,
      questionNumber,
    })
    for (let lineIdx = 1; lineIdx < lines.length; lineIdx += 1) {
      const line = lines[lineIdx]
      if (line !== undefined) {
        out.push({
          role: 'continuation',
          text: line,
          sectionId,
          itemId,
          childId,
          questionNumber,
        })
      }
    }
  }
}

function buildQuestionPrefix(
  qNumber: number,
  individualScore: number | undefined,
  includeScorePrefix: boolean,
): string {
  if (
    includeScorePrefix &&
    typeof individualScore === 'number' &&
    Number.isFinite(individualScore) &&
    individualScore > 0
  ) {
    return `${qNumber}.（本题${formatScore(individualScore)}分）`
  }
  return `${qNumber}.`
}

function pushStemWithOptions(
  out: RenderedParagraph[],
  prefix: string,
  stem: string,
  options: QuestionOption[],
  role: 'question-stem' | 'sub-question-stem',
  sectionId: string,
  itemId: string,
  questionNumber?: number,
  childId?: string,
) {
  const lines = splitTrimmedLines(stem)
  const first = lines[0] ?? ''
  out.push({
    role,
    text: `${prefix}${first}`,
    prefix,
    body: first,
    sectionId,
    itemId,
    childId,
    questionNumber,
  })
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line !== undefined) {
      out.push({
        role: 'continuation',
        text: line,
        sectionId,
        itemId,
        childId,
        questionNumber,
      })
    }
  }

  for (const optionLine of formatOptionLines(options)) {
    out.push({
      role: 'option',
      text: optionLine,
      sectionId,
      itemId,
      childId,
      questionNumber,
    })
  }
}

function pushStandardOrGroupChild(
  out: RenderedParagraph[],
  item: StandardQuestionItem | GroupChildQuestion,
  qNumber: number,
  includeScorePrefix: boolean,
  allowTaxonomyTags: boolean,
  sectionId: string,
  parentItemId?: string,
) {
  const effectiveItemId = parentItemId ?? item.id
  const childId = parentItemId ? item.id : undefined
  const prefix = buildQuestionPrefix(qNumber, item.score, includeScorePrefix)
  pushStemWithOptions(
    out,
    prefix,
    item.stem,
    item.options,
    'question-stem',
    sectionId,
    effectiveItemId,
    qNumber,
    childId,
  )

  if (allowTaxonomyTags && 'difficulty' in item) {
    const difficulty = item.difficulty.trim()
    if (difficulty) {
      pushTaggedBlock(out, '【难度】', difficulty, sectionId, effectiveItemId, qNumber, childId)
    }
    const kp = normalizeKnowledgePoints(item.knowledgePoints)
    if (kp) {
      pushTaggedBlock(out, '【知识点】', kp, sectionId, effectiveItemId, qNumber, childId)
    }
  }

  if (item.answer.trim()) {
    pushTaggedBlock(out, '【答案】', item.answer, sectionId, effectiveItemId, qNumber, childId)
  }

  const hasSteps = item.steps.some((step) => step.trim().length > 0)
  if (item.analysis.trim()) {
    pushTaggedBlock(out, '【解析】', item.analysis, sectionId, effectiveItemId, qNumber, childId)
  } else if (hasSteps) {
    out.push({
      role: 'tag-header',
      text: '【解析】',
      prefix: '【解析】',
      body: '',
      sectionId,
      itemId: effectiveItemId,
      childId,
      questionNumber: qNumber,
    })
  }

  if (hasSteps) {
    pushQuestionSteps(out, item.steps, sectionId, effectiveItemId, qNumber, childId)
  }
}

function pushCompoundQuestion(
  out: RenderedParagraph[],
  item: CompoundQuestionItem,
  qNumber: number,
  includeScorePrefix: boolean,
  sectionId: string,
) {
  const prefix = buildQuestionPrefix(qNumber, item.score, includeScorePrefix)
  pushStemWithOptions(
    out,
    prefix,
    item.stem,
    [],
    'question-stem',
    sectionId,
    item.id,
    qNumber,
  )

  for (let subIdx = 0; subIdx < item.subQuestions.length; subIdx += 1) {
    const sub = item.subQuestions[subIdx]
    if (!sub) continue
    const subPrefix = `（${subIdx + 1}）`
    pushStemWithOptions(
      out,
      subPrefix,
      sub.stem,
      sub.options,
      'sub-question-stem',
      sectionId,
      item.id,
      qNumber,
    )
  }

  const difficulty = item.difficulty.trim()
  if (difficulty) {
    pushTaggedBlock(out, '【难度】', difficulty, sectionId, item.id, qNumber)
  }

  const kp = normalizeKnowledgePoints(item.knowledgePoints)
  if (kp) {
    pushTaggedBlock(out, '【知识点】', kp, sectionId, item.id, qNumber)
  }

  const hasAnySubAnswer = item.subQuestions.some((sub) => sub.answer.trim().length > 0)
  if (hasAnySubAnswer) {
    out.push({
      role: 'tag-header',
      text: '【答案】',
      prefix: '【答案】',
      body: '',
      sectionId,
      itemId: item.id,
      questionNumber: qNumber,
    })
    for (let subIdx = 0; subIdx < item.subQuestions.length; subIdx += 1) {
      const sub = item.subQuestions[subIdx]
      if (!sub) continue
      const subPrefix = `（${subIdx + 1}）`
      const lines = splitTrimmedLines(sub.answer)
      const first = lines[0] ?? ''
      out.push({
        role: 'sub-answer',
        text: `${subPrefix}${first}`,
        prefix: subPrefix,
        body: first,
        sectionId,
        itemId: item.id,
        questionNumber: qNumber,
      })
      for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i]
        if (line !== undefined) {
          out.push({
            role: 'continuation',
            text: line,
            sectionId,
            itemId: item.id,
            questionNumber: qNumber,
          })
        }
      }
    }
  }

  const hasAnySubAnalysisOrSteps = item.subQuestions.some(
    (sub) => sub.analysis.trim().length > 0 || sub.steps.some((step) => step.trim().length > 0),
  )
  if (hasAnySubAnalysisOrSteps) {
    out.push({
      role: 'tag-header',
      text: '【解析】',
      prefix: '【解析】',
      body: '',
      sectionId,
      itemId: item.id,
      questionNumber: qNumber,
    })
    for (let subIdx = 0; subIdx < item.subQuestions.length; subIdx += 1) {
      const sub = item.subQuestions[subIdx]
      if (!sub) continue
      const subPrefix = `（${subIdx + 1}）`
      const lines = splitTrimmedLines(sub.analysis)
      const first = lines[0] ?? ''
      out.push({
        role: 'sub-analysis',
        text: `${subPrefix}${first}`,
        prefix: subPrefix,
        body: first,
        sectionId,
        itemId: item.id,
        questionNumber: qNumber,
      })
      for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i]
        if (line !== undefined) {
          out.push({
            role: 'continuation',
            text: line,
            sectionId,
            itemId: item.id,
            questionNumber: qNumber,
          })
        }
      }
      if (sub.steps.some((step) => step.trim().length > 0)) {
        pushQuestionSteps(out, sub.steps, sectionId, item.id, qNumber)
      }
    }
  }
}

export function buildRenderedParagraphs(doc: ExamDocument): RenderedParagraph[] {
  const out: RenderedParagraph[] = []
  const { questionNumbers, groupIndexes } = computePaperNumbering(doc)

  const titleText = doc.title.trim() || '未命名试卷'
  out.push({
    role: 'title',
    text: titleText,
  })

  for (let secIdx = 0; secIdx < doc.sections.length; secIdx += 1) {
    const section = doc.sections[secIdx]
    if (!section) continue

    const sectionNumeral = toChineseNumeral(secIdx + 1)
    const cleanSectionTitle = section.title.trim() || '未命名大题'
    let headerText = `${sectionNumeral}、${cleanSectionTitle}`
    if (
      section.scoreMode === 'uniform' &&
      typeof section.scorePerQuestion === 'number' &&
      Number.isFinite(section.scorePerQuestion) &&
      section.scorePerQuestion > 0
    ) {
      headerText += `（每小题${formatScore(section.scorePerQuestion)}分）`
    }

    out.push({
      role: 'section-header',
      text: headerText,
      sectionId: section.id,
    })

    const includeScorePrefix = section.scoreMode === 'per-question'

    for (const item of section.items) {
      if (item.kind === 'group') {
        const groupIdx = groupIndexes.get(item.id) ?? 1
        out.push({
          role: 'group-delimiter',
          text: formatGroupDelimiter(item.delimiterStyle, groupIdx),
          sectionId: section.id,
          itemId: item.id,
        })

        const passageLines = splitTrimmedLines(item.passage)
        if (passageLines.length > 0) {
          out.push({
            role: 'group-passage',
            text: passageLines[0] ?? '',
            sectionId: section.id,
            itemId: item.id,
          })
          for (let i = 1; i < passageLines.length; i += 1) {
            const line = passageLines[i]
            if (line !== undefined) {
              out.push({
                role: 'continuation',
                text: line,
                sectionId: section.id,
                itemId: item.id,
              })
            }
          }
        }

        for (const child of item.questions) {
          const qNum = questionNumbers.get(child.id) ?? 1
          pushStandardOrGroupChild(
            out,
            child,
            qNum,
            includeScorePrefix,
            false,
            section.id,
            item.id,
          )
        }
      } else if (item.kind === 'compound') {
        const qNum = questionNumbers.get(item.id) ?? 1
        pushCompoundQuestion(out, item, qNum, includeScorePrefix, section.id)
      } else {
        const qNum = questionNumbers.get(item.id) ?? 1
        pushStandardOrGroupChild(out, item, qNum, includeScorePrefix, true, section.id)
      }
    }
  }

  return out
}

export function renderExamPlainText(doc: ExamDocument): string {
  return buildRenderedParagraphs(doc)
    .map((p) => p.text)
    .join('\n')
}

export function computePaperStats(doc: ExamDocument): PaperStats {
  let questionCount = 0
  let subQuestionCount = 0
  let groupCount = 0
  let scoredQuestionCount = 0
  let totalScore = 0

  for (const section of doc.sections) {
    const uniformScore =
      section.scoreMode === 'uniform' &&
      typeof section.scorePerQuestion === 'number' &&
      Number.isFinite(section.scorePerQuestion) &&
      section.scorePerQuestion > 0
        ? section.scorePerQuestion
        : null

    for (const item of section.items) {
      if (item.kind === 'group') {
        groupCount += 1
        for (const child of item.questions) {
          questionCount += 1
          if (uniformScore !== null) {
            scoredQuestionCount += 1
            totalScore += uniformScore
          } else if (
            section.scoreMode === 'per-question' &&
            typeof child.score === 'number' &&
            Number.isFinite(child.score) &&
            child.score > 0
          ) {
            scoredQuestionCount += 1
            totalScore += child.score
          }
        }
      } else {
        questionCount += 1
        if (item.kind === 'compound') {
          subQuestionCount += item.subQuestions.length
        }
        if (uniformScore !== null) {
          scoredQuestionCount += 1
          totalScore += uniformScore
        } else if (
          section.scoreMode === 'per-question' &&
          typeof item.score === 'number' &&
          Number.isFinite(item.score) &&
          item.score > 0
        ) {
          scoredQuestionCount += 1
          totalScore += item.score
        }
      }
    }
  }

  return {
    sectionCount: doc.sections.length,
    questionCount,
    subQuestionCount,
    groupCount,
    scoredQuestionCount,
    totalScore: Math.round(totalScore * 100) / 100,
    allScored: questionCount > 0 && scoredQuestionCount === questionCount,
  }
}

export function validateExamDocument(doc: ExamDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { questionNumbers, groupIndexes } = computePaperNumbering(doc)

  if (!doc.title.trim()) {
    issues.push({
      severity: 'error',
      code: 'empty-title',
      message: '请填写试卷名称。',
    })
  }

  if (doc.sections.length === 0) {
    issues.push({
      severity: 'error',
      code: 'no-sections',
      message: '试卷至少需要包含一个大题。',
    })
    return issues
  }

  for (let secIdx = 0; secIdx < doc.sections.length; secIdx += 1) {
    const section = doc.sections[secIdx]
    if (!section) continue
    const secLabel = `第 ${toChineseNumeral(secIdx + 1)} 大题`

    if (!section.title.trim()) {
      issues.push({
        severity: 'error',
        code: 'empty-section-title',
        message: `${secLabel} 缺少大题名称。`,
        sectionId: section.id,
      })
    }

    if (section.items.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'empty-section',
        message: `${secLabel}（${section.title || '未命名'}）还没有添加任何题目。`,
        sectionId: section.id,
      })
    }

    if (
      section.scoreMode === 'uniform' &&
      !(
        typeof section.scorePerQuestion === 'number' &&
        Number.isFinite(section.scorePerQuestion) &&
        section.scorePerQuestion > 0
      )
    ) {
      issues.push({
        severity: 'warning',
        code: 'missing-uniform-score',
        message: `${secLabel} 设置为“每小题统一分值”，但未填写有效的每小题分值。`,
        sectionId: section.id,
      })
    }

    for (const item of section.items) {
      if (item.kind === 'standard') {
        const qNum = questionNumbers.get(item.id) ?? 0
        if (!item.stem.trim()) {
          issues.push({
            severity: 'error',
            code: 'empty-question-stem',
            message: `第 ${qNum} 题题干为空。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (
          section.scoreMode === 'per-question' &&
          !(typeof item.score === 'number' && Number.isFinite(item.score) && item.score > 0)
        ) {
          issues.push({
            severity: 'warning',
            code: 'missing-question-score',
            message: `第 ${qNum} 题在逐题标分大题中未填写分值。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (item.difficulty && !DIFFICULTY_LEVELS.includes(item.difficulty)) {
          issues.push({
            severity: 'warning',
            code: 'invalid-difficulty',
            message: `第 ${qNum} 题的难度“${item.difficulty}”不在模板允许的五个等级内。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (item.steps.some((step) => step.trim().length > 0) && !item.analysis.trim()) {
          issues.push({
            severity: 'warning',
            code: 'steps-without-analysis',
            message: `第 ${qNum} 题填写了【步骤】但未填写【解析】内容，导出时将自动补充【解析】标签行。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
      } else if (item.kind === 'compound') {
        const qNum = questionNumbers.get(item.id) ?? 0
        if (!item.stem.trim()) {
          issues.push({
            severity: 'error',
            code: 'empty-question-stem',
            message: `第 ${qNum} 题（子母题）母题题干为空。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (
          section.scoreMode === 'per-question' &&
          !(typeof item.score === 'number' && Number.isFinite(item.score) && item.score > 0)
        ) {
          issues.push({
            severity: 'warning',
            code: 'missing-question-score',
            message: `第 ${qNum} 题（子母题）在逐题标分大题中未填写分值。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (item.difficulty && !DIFFICULTY_LEVELS.includes(item.difficulty)) {
          issues.push({
            severity: 'warning',
            code: 'invalid-difficulty',
            message: `第 ${qNum} 题的难度“${item.difficulty}”不在模板允许的五个等级内。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (item.subQuestions.length === 0) {
          issues.push({
            severity: 'error',
            code: 'empty-sub-questions',
            message: `第 ${qNum} 题（子母题）至少需要包含 1 个子题。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        let answeredCount = 0
        for (let subIdx = 0; subIdx < item.subQuestions.length; subIdx += 1) {
          const sub = item.subQuestions[subIdx]
          if (!sub) continue
          if (!sub.stem.trim()) {
            issues.push({
              severity: 'error',
              code: 'empty-sub-question-stem',
              message: `第 ${qNum} 题的子题（${subIdx + 1}）题干为空。`,
              sectionId: section.id,
              itemId: item.id,
            })
          }
          if (sub.answer.trim()) {
            answeredCount += 1
          }
          if (sub.steps.some((step) => step.trim().length > 0) && !sub.analysis.trim()) {
            issues.push({
              severity: 'warning',
              code: 'steps-without-analysis',
              message: `第 ${qNum} 题子题（${subIdx + 1}）填写了【步骤】但未填写【解析】。`,
              sectionId: section.id,
              itemId: item.id,
            })
          }
        }
        if (answeredCount > 0 && answeredCount < item.subQuestions.length) {
          issues.push({
            severity: 'warning',
            code: 'partial-sub-answers',
            message: `第 ${qNum} 题（子母题）仅填写了部分子题答案，其余子题将输出空序号占位。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
      } else {
        const grpIdx = groupIndexes.get(item.id) ?? 1
        const grpLabel = formatGroupDelimiter(item.delimiterStyle, grpIdx)
        if (!item.passage.trim()) {
          issues.push({
            severity: 'error',
            code: 'empty-group-passage',
            message: `${secLabel}题组 ${grpLabel} 的“题组题干内容”不能为空（模板硬性要求）。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        if (item.questions.length === 0) {
          issues.push({
            severity: 'error',
            code: 'empty-group-questions',
            message: `${secLabel}题组 ${grpLabel} 至少需要包含 1 道小题。`,
            sectionId: section.id,
            itemId: item.id,
          })
        }
        for (const child of item.questions) {
          const qNum = questionNumbers.get(child.id) ?? 0
          if (!child.stem.trim()) {
            issues.push({
              severity: 'error',
              code: 'empty-question-stem',
              message: `题组 ${grpLabel} 中的第 ${qNum} 题题干为空。`,
              sectionId: section.id,
              itemId: item.id,
              childId: child.id,
            })
          }
          if (
            section.scoreMode === 'per-question' &&
            !(typeof child.score === 'number' && Number.isFinite(child.score) && child.score > 0)
          ) {
            issues.push({
              severity: 'warning',
              code: 'missing-question-score',
              message: `题组 ${grpLabel} 中的第 ${qNum} 题在逐题标分大题中未填写分值。`,
              sectionId: section.id,
              itemId: item.id,
              childId: child.id,
            })
          }
          if (child.steps.some((step) => step.trim().length > 0) && !child.analysis.trim()) {
            issues.push({
              severity: 'warning',
              code: 'steps-without-analysis',
              message: `第 ${qNum} 题填写了【步骤】但未填写【解析】内容，导出时将自动补充【解析】标签行。`,
              sectionId: section.id,
              itemId: item.id,
              childId: child.id,
            })
          }
        }
      }
    }
  }

  return issues
}

export function splitEmbeddedOptions(rawStem: string): {
  stem: string
  options: QuestionOption[]
} | null {
  const lines = rawStem.replace(/\r\n?/g, '\n').split('\n')
  const startIdx = lines.findIndex((line) => /^A\s*[.．、)\]]\s*\S/.test(line.trim()))
  if (startIdx <= 0) return null

  const stem = lines
    .slice(0, startIdx)
    .join('\n')
    .trim()
  if (!stem) return null

  const parsedOptions: QuestionOption[] = []

  for (let i = startIdx; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? '').trim()
    if (!trimmed) continue

    const segments = trimmed
      .split(/(?:\t+|\s{2,})(?=[A-H]\s*[.．、)\]])|\s+(?=[B-H]\s*[．、])/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)

    if (segments.length === 0) return null

    for (const seg of segments) {
      const match = seg.match(/^([A-H])\s*[.．、)\]]\s*(.*)$/)
      if (!match) return null
      const expectedLabel = String.fromCharCode(65 + parsedOptions.length)
      const label = match[1] ?? ''
      if (label !== expectedLabel) return null
      parsedOptions.push({
        label,
        text: (match[2] ?? '').trim(),
      })
    }
  }

  if (parsedOptions.length < 2) return null

  return {
    stem,
    options: parsedOptions,
  }
}
