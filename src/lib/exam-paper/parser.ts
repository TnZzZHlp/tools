import { normalizeKnowledgePoints } from './render'
import {
  createCompoundQuestion,
  createGroupChildQuestion,
  createQuestionGroup,
  createSection,
  createStandardQuestion,
  createSubQuestion,
  DIFFICULTY_LEVELS,
  type CompoundQuestionItem,
  type DifficultyLevel,
  type ExamDocument,
  type ExamSection,
  type GroupChildQuestion,
  type GroupDelimiterStyle,
  type QuestionGroupItem,
  type QuestionOption,
  type SectionScoreMode,
  type StandardQuestionItem,
  type SubQuestion,
} from './types'
import { readZipEntries } from './zip'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

type TagMode = 'stem' | 'difficulty' | 'knowledge' | 'answer' | 'analysis' | 'step'

interface NumberingDefinition {
  start: number
  lvlText: string
}

function isDifficultyLevel(value: string): value is DifficultyLevel {
  return (DIFFICULTY_LEVELS as readonly string[]).includes(value)
}

function appendLine(existing: string, line: string): string {
  return existing ? `${existing}\n${line}` : line
}

function appendStemLine(existing: string, line: string): string {
  if (!existing) return line
  if (existing.length >= 22 && !/[。！？：:;；”’）)]$/.test(existing)) {
    const needsSpace = /[A-Za-z0-9]$/.test(existing) && /^[A-Za-z0-9]/.test(line)
    return `${existing}${needsSpace ? ' ' : ''}${line}`
  }
  return `${existing}\n${line}`
}

function parseOptionSegment(segment: string): QuestionOption | null {
  const match = segment.match(/^([A-H])\s*[.．、)\]]\s*(.*)$/)
  if (!match) return null
  return {
    label: match[1] ?? 'A',
    text: (match[2] ?? '').trim(),
  }
}

function parseOptionsFromLine(line: string): {
  options: QuestionOption[]
  countOnLine: number
} | null {
  const trimmed = line.trim()
  if (!/^[A-H]\s*[.．、]/.test(trimmed)) return null

  const segments = trimmed
    .split(/(?:\t+|\s{2,})(?=[A-H]\s*[.．、])|\s+(?=[B-H]\s*[.．、])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const parsed: QuestionOption[] = []
  for (const segment of segments) {
    const opt = parseOptionSegment(segment)
    if (!opt) return null
    parsed.push(opt)
  }

  return parsed.length > 0 ? { options: parsed, countOnLine: parsed.length } : null
}

function parseSectionHeader(rawLine: string): {
  title: string
  scoreMode: SectionScoreMode
  scorePerQuestion?: number
  sectionTotalScore?: number
} | null {
  const normalizedLine = rawLine.replace(/^[―—－﹣]+(?=\s*[、.．])/, '一')
  const match = normalizedLine.match(/^([一二三四五六七八九十百]+)\s*[、.．]\s*(.+)$/)
  if (!match) return null

  const cleaned = (match[2] ?? '').replace(/\[+$/g, '').trim()
  const parenMatch = cleaned.match(/^(.+?)\s*[（(]([^（）()]+)[)）]$/)
  if (parenMatch) {
    const baseTitle = (parenMatch[1] ?? '').trim() || cleaned
    const inner = (parenMatch[2] ?? '').trim()

    const perItemScoreMatch = inner.match(
      /每\s*(?:小题|题|空格|空|道题|道)\s*(\d+(?:\.\d+)?)\s*分/,
    )
    if (perItemScoreMatch) {
      const score = Number(perItemScoreMatch[1])
      return {
        title: baseTitle,
        scoreMode: 'uniform',
        scorePerQuestion: Number.isFinite(score) && score > 0 ? score : undefined,
      }
    }

    if (/每\s*(?:小题|题|空格|空)\s*分/.test(inner)) {
      return {
        title: baseTitle,
        scoreMode: 'uniform',
        scorePerQuestion: undefined,
      }
    }

    const totalOnlyMatch = inner.match(/^(?:共|本题|本大题|满分)?\s*(\d+(?:\.\d+)?)\s*分$/)
    if (totalOnlyMatch) {
      const totalScore = Number(totalOnlyMatch[1])
      return {
        title: baseTitle,
        scoreMode: 'none',
        sectionTotalScore: Number.isFinite(totalScore) && totalScore > 0 ? totalScore : undefined,
      }
    }
  }

  return {
    title: cleaned,
    scoreMode: 'none',
  }
}

function isPageArtifactOrPreambleBoilerplate(
  line: string,
  beforeFirstSection: boolean,
): boolean {
  if (
    /^第\s*\d+\s*页(?:\s*[/／,，]?\s*共\s*\d+\s*页)?$/.test(line) ||
    /^-\s*\d+\s*-$/.test(line) ||
    /^Page\s+\d+(?:\s+of\s+\d+)?$/i.test(line)
  ) {
    return true
  }

  if (!beforeFirstSection) return false

  if (
    /^(?:专业|年级|班级|姓名|学号|考号|准考证号|学院|系别|座位号)(?:[\s_＿:：]|专业|年级|班级|姓名|学号|考号|准考证号|学院|系别|座位号)+$/.test(
      line,
    )
  ) {
    return true
  }

  if (
    /^题\s*号[\s_＿|｜一二三四五六七八九十百总分得分]+$/.test(line) ||
    /^(?:得\s*分|阅卷人|评卷人|登分人|复核人|合分人)[\s_＿|｜]*$/.test(line) ||
    /^(?:密封线|装订线)/.test(line)
  ) {
    return true
  }

  return false
}

function parseGroupDelimiter(line: string): {
  style: GroupDelimiterStyle
  trailing: string
} | null {
  const cnParen = line.match(/^[（(]([一二三四五六七八九十]+)[)）]\s*(.*)$/)
  if (cnParen) {
    return {
      style: 'chinese-paren',
      trailing: (cnParen[2] ?? '').trim(),
    }
  }

  const cnSection = line.match(/^第([一二三四五六七八九十]+)节(?:[\s：:]+(.*))?$/)
  if (cnSection) {
    return {
      style: 'chinese-section',
      trailing: (cnSection[2] ?? '').trim(),
    }
  }

  const singleLetter = line.match(/^([A-Z])$/)
  if (singleLetter) {
    return {
      style: 'uppercase-letter',
      trailing: '',
    }
  }

  return null
}

function parseScorePrefix(body: string): { score?: number; stem: string } {
  const match = body.match(/^[（(]\s*本题\s*(\d+(?:\.\d+)?)\s*分\s*[)）]\s*(.*)$/)
  if (!match) return { stem: body }
  const score = Number(match[1])
  return {
    score: Number.isFinite(score) && score > 0 ? score : undefined,
    stem: (match[2] ?? '').trim(),
  }
}

export function parseExamText(rawText: string): ExamDocument {
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n')

  let title = ''
  const sections: ExamSection[] = []
  const sectionTotalScores = new Map<string, number>()

  let currentSection: ExamSection | null = null
  let currentGroup: QuestionGroupItem | null = null
  let currentQuestion: StandardQuestionItem | CompoundQuestionItem | GroupChildQuestion | null =
    null
  let activeSubIndex = -1
  let tagMode: TagMode = 'stem'

  function ensureSection(): ExamSection {
    if (!currentSection) {
      currentSection = createSection({ title: '试题', scoreMode: 'none' })
      sections.push(currentSection)
    }
    return currentSection
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Ignore template-only inline instruction notes inside question groups
    if (/^说明：题组暂不支持设置小题的[“"]难度[”"]和[“"]知识点[”"]/.test(line)) {
      continue
    }

    if (isPageArtifactOrPreambleBoilerplate(line, currentSection === null)) {
      continue
    }

    const sectionHeader = parseSectionHeader(line)
    if (sectionHeader) {
      currentSection = createSection({
        title: sectionHeader.title,
        scoreMode: sectionHeader.scoreMode,
        scorePerQuestion: sectionHeader.scorePerQuestion,
      })
      if (sectionHeader.sectionTotalScore !== undefined) {
        sectionTotalScores.set(currentSection.id, sectionHeader.sectionTotalScore)
      }
      sections.push(currentSection)
      currentGroup = null
      currentQuestion = null
      activeSubIndex = -1
      tagMode = 'stem'
      continue
    }

    if (!currentSection) {
      const maybeQuestion = /^(\d+)\s*([.．、])\s*(.*)$/.test(line)
      const maybeGroup = parseGroupDelimiter(line) !== null
      if (!maybeQuestion && !maybeGroup) {
        title = title ? `${title} ${line}` : line
        continue
      }
    }

    const section = ensureSection()

    // Check group delimiter when inside a section.
    // Avoid mistaking an answer line like "A" right after an empty "【答案】" for a group delimiter.
    const isLikelySingleLetterAnswer =
      /^[A-Z]$/.test(line) &&
      currentQuestion !== null &&
      tagMode === 'answer' &&
      !('subQuestions' in currentQuestion) &&
      currentQuestion.answer === ''

    if (!isLikelySingleLetterAnswer) {
      const delimiter = parseGroupDelimiter(line)
      if (delimiter) {
        currentGroup = createQuestionGroup({
          delimiterStyle: delimiter.style,
          passage:
            delimiter.trailing && !delimiter.trailing.startsWith('说明：') ? delimiter.trailing : '',
          questions: [],
        })
        section.items.push(currentGroup)
        currentQuestion = null
        activeSubIndex = -1
        tagMode = 'stem'
        continue
      }
    }

    // Numbered question: 1．... or 1. ... or 1、...
    const qMatch = line.match(/^(\d+)\s*([.．、])\s*(.*)$/)
    if (qMatch) {
      const { score, stem } = parseScorePrefix((qMatch[3] ?? '').trim())
      if (score !== undefined && section.scoreMode === 'none') {
        section.scoreMode = 'per-question'
      }

      if (currentGroup) {
        const child = createGroupChildQuestion({
          stem,
          score,
        })
        currentGroup.questions.push(child)
        currentQuestion = child
      } else {
        const q = createStandardQuestion({
          stem,
          score,
        })
        section.items.push(q)
        currentQuestion = q
      }
      activeSubIndex = -1
      tagMode = 'stem'
      continue
    }

    // Sub-question or sub-answer/analysis marker: （1）... or (1)...
    const subMatch = line.match(/^[（(](\d+)[)）]\s*(.*)$/)
    if (subMatch && currentQuestion && !('questions' in currentQuestion)) {
      const subNumber = Math.max(1, Number(subMatch[1]))
      const subBody = (subMatch[2] ?? '').trim()

      if (tagMode === 'stem' && !('subQuestions' in currentQuestion) && !currentGroup) {
        // Promote standard question to compound question
        const promoted: CompoundQuestionItem = createCompoundQuestion({
          id: currentQuestion.id,
          stem: currentQuestion.stem,
          score: currentQuestion.score,
          difficulty: 'difficulty' in currentQuestion ? currentQuestion.difficulty : '',
          knowledgePoints:
            'knowledgePoints' in currentQuestion ? currentQuestion.knowledgePoints : '',
          subQuestions: [],
        })
        const idx = section.items.findIndex((it) => it.id === currentQuestion?.id)
        if (idx >= 0) {
          section.items[idx] = promoted
        }
        currentQuestion = promoted
      }

      if ('subQuestions' in currentQuestion) {
        while (currentQuestion.subQuestions.length < subNumber) {
          currentQuestion.subQuestions.push(createSubQuestion())
        }
        const subIdx = subNumber - 1
        const subTarget = currentQuestion.subQuestions[subIdx]
        if (subTarget) {
          activeSubIndex = subIdx
          if (tagMode === 'answer') {
            subTarget.answer = appendLine(subTarget.answer, subBody)
          } else if (tagMode === 'analysis' || tagMode === 'step') {
            tagMode = 'analysis'
            subTarget.analysis = appendLine(subTarget.analysis, subBody)
          } else {
            subTarget.stem = appendLine(subTarget.stem, subBody)
          }
          continue
        }
      }
    }

    // Question tags
    if (currentQuestion) {
      const diffMatch = line.match(/^【难度】\s*(.*)$/)
      if (diffMatch) {
        tagMode = 'difficulty'
        const rawDiff = (diffMatch[1] ?? '').trim()
        if (!('questions' in currentQuestion) && 'difficulty' in currentQuestion) {
          if (isDifficultyLevel(rawDiff)) {
            currentQuestion.difficulty = rawDiff
          }
        }
        continue
      }

      const kpMatch = line.match(/^【知识点】\s*(.*)$/)
      if (kpMatch) {
        tagMode = 'knowledge'
        const rawKp = (kpMatch[1] ?? '').trim()
        if (!('questions' in currentQuestion) && 'knowledgePoints' in currentQuestion) {
          if (!rawKp.startsWith('选填知识点')) {
            currentQuestion.knowledgePoints = normalizeKnowledgePoints(rawKp)
          }
        }
        continue
      }

      const ansMatch = line.match(/^【答案】\s*(.*)$/)
      if (ansMatch) {
        tagMode = 'answer'
        activeSubIndex = -1
        const ansBody = (ansMatch[1] ?? '').trim()
        if (!('subQuestions' in currentQuestion) && ansBody) {
          currentQuestion.answer = appendLine(currentQuestion.answer, ansBody)
        }
        continue
      }

      const anaMatch = line.match(/^【解析】\s*(.*)$/)
      if (anaMatch) {
        tagMode = 'analysis'
        activeSubIndex = -1
        const anaBody = (anaMatch[1] ?? '').trim()
        if (!('subQuestions' in currentQuestion) && anaBody) {
          currentQuestion.analysis = appendLine(currentQuestion.analysis, anaBody)
        }
        continue
      }

      const stepMatch = line.match(/^【步骤\s*\d+\s*】\s*(.*)$/)
      if (stepMatch) {
        tagMode = 'step'
        const stepBody = (stepMatch[1] ?? '').trim()
        if ('subQuestions' in currentQuestion) {
          const targetSub =
            currentQuestion.subQuestions[activeSubIndex >= 0 ? activeSubIndex : 0]
          if (targetSub) {
            targetSub.steps.push(stepBody)
          }
        } else {
          currentQuestion.steps.push(stepBody)
        }
        continue
      }

      // Options in stem mode
      if (tagMode === 'stem') {
        const parsedOptions = parseOptionsFromLine(line)
        if (parsedOptions) {
          if ('subQuestions' in currentQuestion && activeSubIndex >= 0) {
            const sub = currentQuestion.subQuestions[activeSubIndex]
            if (sub) {
              sub.options.push(...parsedOptions.options)
              continue
            }
          } else if (!('subQuestions' in currentQuestion)) {
            currentQuestion.options.push(...parsedOptions.options)
            continue
          }
        }
      }

      // Continuation lines within active question/tag
      if ('subQuestions' in currentQuestion) {
        const sub =
          activeSubIndex >= 0 ? currentQuestion.subQuestions[activeSubIndex] : undefined
        if (tagMode === 'step' && sub && sub.steps.length > 0) {
          const lastIdx = sub.steps.length - 1
          sub.steps[lastIdx] = appendLine(sub.steps[lastIdx] ?? '', line)
        } else if (tagMode === 'analysis' && sub) {
          sub.analysis = appendLine(sub.analysis, line)
        } else if (tagMode === 'answer' && sub) {
          sub.answer = appendLine(sub.answer, line)
        } else if (tagMode === 'stem' && sub) {
          sub.stem = appendStemLine(sub.stem, line)
        } else if (tagMode === 'stem') {
          currentQuestion.stem = appendStemLine(currentQuestion.stem, line)
        }
      } else {
        if (tagMode === 'step' && currentQuestion.steps.length > 0) {
          const lastIdx = currentQuestion.steps.length - 1
          currentQuestion.steps[lastIdx] = appendLine(currentQuestion.steps[lastIdx] ?? '', line)
        } else if (tagMode === 'analysis') {
          currentQuestion.analysis = appendLine(currentQuestion.analysis, line)
        } else if (tagMode === 'answer') {
          currentQuestion.answer = appendLine(currentQuestion.answer, line)
        } else if (tagMode === 'stem') {
          currentQuestion.stem = appendStemLine(currentQuestion.stem, line)
        }
      }
      continue
    }

    // Group passage lines before the first child question
    if (currentGroup && currentGroup.questions.length === 0) {
      currentGroup.passage = appendLine(currentGroup.passage, line)
    }
  }

  for (const section of sections) {
    const totalScore = sectionTotalScores.get(section.id)
    if (totalScore !== undefined && section.scoreMode === 'none' && section.items.length > 0) {
      section.scoreMode = 'uniform'
      section.scorePerQuestion = Number((totalScore / section.items.length).toFixed(2))
    }
  }

  return {
    title: title || '未命名试卷',
    sections,
  }
}

function parseNumberingDefinitions(numberingXml: string | undefined): {
  numToAbstract: Map<string, string>
  abstractLevels: Map<string, NumberingDefinition>
} {
  const numToAbstract = new Map<string, string>()
  const abstractLevels = new Map<string, NumberingDefinition>()

  if (!numberingXml || typeof DOMParser === 'undefined') {
    return { numToAbstract, abstractLevels }
  }

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(numberingXml, 'application/xml')

  const abstractNodes = xmlDoc.getElementsByTagNameNS(W_NS, 'abstractNum')
  for (let i = 0; i < abstractNodes.length; i += 1) {
    const absNode = abstractNodes.item(i)
    if (!absNode) continue
    const absId = absNode.getAttributeNS(W_NS, 'abstractNumId') ?? absNode.getAttribute('w:abstractNumId')
    if (!absId) continue
    const lvlNodes = absNode.getElementsByTagNameNS(W_NS, 'lvl')
    for (let j = 0; j < lvlNodes.length; j += 1) {
      const lvlNode = lvlNodes.item(j)
      if (!lvlNode) continue
      const ilvl = lvlNode.getAttributeNS(W_NS, 'ilvl') ?? lvlNode.getAttribute('w:ilvl') ?? '0'
      const startEl = lvlNode.getElementsByTagNameNS(W_NS, 'start').item(0)
      const lvlTextEl = lvlNode.getElementsByTagNameNS(W_NS, 'lvlText').item(0)
      const startRaw = startEl?.getAttributeNS(W_NS, 'val') ?? startEl?.getAttribute('w:val') ?? '1'
      const lvlText =
        lvlTextEl?.getAttributeNS(W_NS, 'val') ?? lvlTextEl?.getAttribute('w:val') ?? '%1.'
      const start = Number(startRaw)
      abstractLevels.set(`${absId}:${ilvl}`, {
        start: Number.isFinite(start) ? start : 1,
        lvlText,
      })
    }
  }

  const numNodes = xmlDoc.getElementsByTagNameNS(W_NS, 'num')
  for (let i = 0; i < numNodes.length; i += 1) {
    const numNode = numNodes.item(i)
    if (!numNode) continue
    const numId = numNode.getAttributeNS(W_NS, 'numId') ?? numNode.getAttribute('w:numId')
    const absRef = numNode.getElementsByTagNameNS(W_NS, 'abstractNumId').item(0)
    const absId = absRef?.getAttributeNS(W_NS, 'val') ?? absRef?.getAttribute('w:val')
    if (numId && absId) {
      numToAbstract.set(numId, absId)
    }
  }

  return { numToAbstract, abstractLevels }
}

function isHiddenWhiteRun(runEl: Element): boolean {
  const rPr = runEl.getElementsByTagNameNS(W_NS, 'rPr').item(0)
  if (!rPr) return false
  const colorEl = rPr.getElementsByTagNameNS(W_NS, 'color').item(0)
  if (!colorEl) return false
  const val = colorEl.getAttributeNS(W_NS, 'val') ?? colorEl.getAttribute('w:val')
  return typeof val === 'string' && val.toUpperCase() === 'FFFFFF'
}

function extractParagraphText(pEl: Element): string {
  const parts: string[] = []

  const walkRuns = (node: Element) => {
    for (let i = 0; i < node.children.length; i += 1) {
      const child = node.children.item(i)
      if (!child) continue
      const localName = child.localName
      if (localName === 'r') {
        if (isHiddenWhiteRun(child)) continue
        for (let j = 0; j < child.children.length; j += 1) {
          const rChild = child.children.item(j)
          if (!rChild) continue
          if (rChild.localName === 't') {
            parts.push(rChild.textContent ?? '')
          } else if (rChild.localName === 'tab') {
            parts.push('\t')
          } else if (rChild.localName === 'br') {
            parts.push('\n')
          }
        }
      } else if (localName === 'hyperlink') {
        walkRuns(child)
      }
    }
  }

  walkRuns(pEl)
  return parts.join('')
}

export async function parseExamDocx(data: ArrayBuffer | Uint8Array): Promise<ExamDocument> {
  const entries = await readZipEntries(data)
  const docEntry = entries.get('word/document.xml')
  if (!docEntry) {
    throw new Error('压缩包内未找到 word/document.xml，不是有效的 Word 试卷文档。')
  }

  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境缺少 XML 解析器，无法解析 .docx 文档。')
  }

  const decoder = new TextDecoder('utf-8')
  const docXmlText = decoder.decode(docEntry)
  const numberingEntry = entries.get('word/numbering.xml')
  const numberingXmlText = numberingEntry ? decoder.decode(numberingEntry) : undefined

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(docXmlText, 'application/xml')
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('word/document.xml 格式损坏，无法解析。')
  }

  const { numToAbstract, abstractLevels } = parseNumberingDefinitions(numberingXmlText)
  const counters = new Map<string, number>()

  const body = xmlDoc.getElementsByTagNameNS(W_NS, 'body').item(0)
  if (!body) {
    throw new Error('Word 文档主体为空，无法提取试卷内容。')
  }

  const paragraphLines: string[] = []
  for (let i = 0; i < body.children.length; i += 1) {
    const child = body.children.item(i)
    if (!child || child.localName !== 'p') continue

    let prefix = ''
    const pPr = child.getElementsByTagNameNS(W_NS, 'pPr').item(0)
    const numPr = pPr?.getElementsByTagNameNS(W_NS, 'numPr').item(0)
    if (numPr) {
      const numIdEl = numPr.getElementsByTagNameNS(W_NS, 'numId').item(0)
      const ilvlEl = numPr.getElementsByTagNameNS(W_NS, 'ilvl').item(0)
      const numId = numIdEl?.getAttributeNS(W_NS, 'val') ?? numIdEl?.getAttribute('w:val')
      const ilvl = ilvlEl?.getAttributeNS(W_NS, 'val') ?? ilvlEl?.getAttribute('w:val') ?? '0'
      if (numId) {
        const absId = numToAbstract.get(numId)
        const def = absId ? abstractLevels.get(`${absId}:${ilvl}`) : undefined
        const counterKey = `${numId}:${ilvl}`
        const currentVal = counters.get(counterKey) ?? def?.start ?? 1
        counters.set(counterKey, currentVal + 1)
        const pattern = def?.lvlText ?? '（%1）'
        prefix = pattern.replace(/%\d+/g, String(currentVal))
      }
    }

    const text = extractParagraphText(child)
    const fullLine = `${prefix}${text}`.trim()
    if (fullLine) {
      paragraphLines.push(fullLine)
    }
  }

  return parseExamText(paragraphLines.join('\n'))
}

interface PdfTextToken {
  text: string
  x: number
  y: number
  w: number
}

interface PdfVisualRow {
  text: string
  baseX: number
  minX: number
  maxX: number
  isStructural: boolean
}

const CJK_INNER_SPACE_RE =
  /(?<=[\u4e00-\u9fff《》“”‘’（）、，。！？；：•·])\s+(?=[\u4e00-\u9fff《》“”‘’（）、，。！？；：•·])/g

function isStructuralExamLine(line: string): boolean {
  return (
    parseSectionHeader(line) !== null ||
    parseGroupDelimiter(line) !== null ||
    /^\d+\s*[.．、]/.test(line) ||
    /^[（(]\d+[)）]/.test(line) ||
    /^[A-H]\s*[.．、)\]]/.test(line) ||
    /^【(?:难度|知识点|答案|解析|步骤\s*\d+)】/.test(line)
  )
}

export async function parseExamPdf(data: ArrayBuffer | Uint8Array): Promise<ExamDocument> {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data)
  const bytes = new Uint8Array(source.byteLength)
  bytes.set(source)

  const pdfjs = await import('pdfjs-dist')
  const hasWebWorker = typeof Worker !== 'undefined'
  if (hasWebWorker && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  }

  const base = `${import.meta.env.BASE_URL ?? '/'}pdf-assets/`
  const loadingTask = pdfjs.getDocument(
    hasWebWorker
      ? {
          data: bytes,
          cMapUrl: `${base}cmaps/`,
          cMapPacked: true,
          iccUrl: `${base}iccs/`,
          standardFontDataUrl: `${base}standard_fonts/`,
          wasmUrl: `${base}wasm/`,
          useSystemFonts: true,
          enableXfa: false,
        }
      : {
          data: bytes,
          useSystemFonts: true,
          enableXfa: false,
        },
  )

  const pdf = await loadingTask.promise
  const mergedRows: PdfVisualRow[] = []
  let seenSection = false

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo)
      try {
        const textContent = await page.getTextContent()
        const tokens: PdfTextToken[] = []

        for (const item of textContent.items) {
          if (!('str' in item)) continue
          const rawStr = item.str
          if (!rawStr || !rawStr.trim()) continue
          const tx = Number(item.transform?.[4] ?? 0)
          const ty = Number(item.transform?.[5] ?? 0)
          const width = Number(item.width ?? 0)
          tokens.push({
            text: rawStr,
            x: Number.isFinite(tx) ? tx : 0,
            y: Number.isFinite(ty) ? ty : 0,
            w: Number.isFinite(width) && width > 0 ? width : 0,
          })
        }

        tokens.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x))

        const rawRows: Array<{ y: number; tokens: PdfTextToken[] }> = []
        for (const tok of tokens) {
          const lastRow = rawRows[rawRows.length - 1]
          if (lastRow && Math.abs(lastRow.y - tok.y) <= 3) {
            lastRow.tokens.push(tok)
          } else {
            rawRows.push({ y: tok.y, tokens: [tok] })
          }
        }

        for (const row of rawRows) {
          row.tokens.sort((a, b) => a.x - b.x)
          const firstTok = row.tokens[0]
          const lastTok = row.tokens[row.tokens.length - 1]
          if (!firstTok || !lastTok) continue

          const firstTrimmed = firstTok.text.trim()
          const isOptionRow = /^[A-H]\s*[.．、)\]]/.test(firstTrimmed)

          let lineText = ''
          let prevEnd: number | null = null
          for (const tok of row.tokens) {
            if (prevEnd !== null) {
              const gap = tok.x - prevEnd
              const nextIsOpt = /^[A-H]\s*[.．、)\]]/.test(tok.text.trim())
              if (isOptionRow && nextIsOpt && gap >= 12) {
                lineText += '    '
              } else if (!isOptionRow && gap >= 24) {
                lineText += '______'
              } else if (gap >= 6) {
                lineText += ' '
              }
            }
            lineText += tok.text
            prevEnd = tok.x + tok.w
          }

          lineText = lineText.replace(CJK_INNER_SPACE_RE, '').trim()
          if (!lineText) continue

          if (isPageArtifactOrPreambleBoilerplate(lineText, !seenSection)) {
            continue
          }

          if (parseSectionHeader(lineText) !== null) {
            seenSection = true
          }

          const minX = firstTok.x
          const maxX = lastTok.x + lastTok.w
          const structural = isStructuralExamLine(lineText)
          const prevRow = mergedRows[mergedRows.length - 1]

          if (
            seenSection &&
            prevRow &&
            !isOptionRow &&
            !structural &&
            !/^[A-H]\s*[.．、)\]]/.test(prevRow.text) &&
            parseSectionHeader(prevRow.text) === null &&
            prevRow.maxX >= 450 &&
            !/[：:]$/.test(prevRow.text) &&
            minX <= prevRow.baseX + 6
          ) {
            const needsSpace =
              /[A-Za-z0-9]$/.test(prevRow.text) && /^[A-Za-z0-9]/.test(lineText)
            prevRow.text = `${prevRow.text}${needsSpace ? ' ' : ''}${lineText}`
            prevRow.maxX = maxX
          } else {
            mergedRows.push({
              text: lineText,
              baseX: minX,
              minX,
              maxX,
              isStructural: structural,
            })
          }
        }
      } finally {
        page.cleanup()
      }
    }
  } finally {
    await loadingTask.destroy()
  }

  return parseExamText(mergedRows.map((r) => r.text).join('\n'))
}

function normalizeOptionsInput(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return []
  const result: QuestionOption[] = []
  for (let idx = 0; idx < raw.length; idx += 1) {
    const entry = raw[idx]
    const fallbackLabel = String.fromCharCode(65 + idx)
    if (typeof entry === 'string') {
      const parsed = parseOptionSegment(entry.trim())
      result.push(parsed ?? { label: fallbackLabel, text: entry.trim() })
    } else if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>
      const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : fallbackLabel
      const text = typeof obj.text === 'string' ? obj.text : ''
      result.push({ label, text })
    }
  }
  return result
}

function normalizeStepsInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

function normalizeDifficulty(raw: unknown): DifficultyLevel | '' {
  if (typeof raw === 'string' && isDifficultyLevel(raw.trim())) {
    return raw.trim() as DifficultyLevel
  }
  return ''
}

function normalizeScore(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

function normalizeSubQuestion(raw: unknown): SubQuestion {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return createSubQuestion({
    id: typeof obj.id === 'string' && obj.id ? obj.id : undefined,
    stem: typeof obj.stem === 'string' ? obj.stem : '',
    options: normalizeOptionsInput(obj.options),
    answer: typeof obj.answer === 'string' ? obj.answer : '',
    analysis: typeof obj.analysis === 'string' ? obj.analysis : '',
    steps: normalizeStepsInput(obj.steps),
  })
}

function normalizeGroupChild(raw: unknown): GroupChildQuestion {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return createGroupChildQuestion({
    id: typeof obj.id === 'string' && obj.id ? obj.id : undefined,
    stem: typeof obj.stem === 'string' ? obj.stem : '',
    options: normalizeOptionsInput(obj.options),
    score: normalizeScore(obj.score),
    answer: typeof obj.answer === 'string' ? obj.answer : '',
    analysis: typeof obj.analysis === 'string' ? obj.analysis : '',
    steps: normalizeStepsInput(obj.steps),
  })
}

function normalizeSectionItem(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    return createStandardQuestion()
  }
  const obj = raw as Record<string, unknown>

  const inferredKind =
    obj.kind === 'compound' || obj.kind === 'group' || obj.kind === 'standard'
      ? obj.kind
      : Array.isArray(obj.subQuestions)
        ? 'compound'
        : 'passage' in obj || Array.isArray(obj.questions)
          ? 'group'
          : 'standard'

  if (inferredKind === 'group') {
    const delimiterStyle: GroupDelimiterStyle =
      obj.delimiterStyle === 'chinese-section' ||
      obj.delimiterStyle === 'uppercase-letter' ||
      obj.delimiterStyle === 'chinese-paren'
        ? obj.delimiterStyle
        : 'chinese-paren'

    return createQuestionGroup({
      id: typeof obj.id === 'string' && obj.id ? obj.id : undefined,
      delimiterStyle,
      passage: typeof obj.passage === 'string' ? obj.passage : '',
      questions: Array.isArray(obj.questions)
        ? obj.questions.map(normalizeGroupChild)
        : [createGroupChildQuestion()],
    })
  }

  if (inferredKind === 'compound') {
    return createCompoundQuestion({
      id: typeof obj.id === 'string' && obj.id ? obj.id : undefined,
      stem: typeof obj.stem === 'string' ? obj.stem : '',
      score: normalizeScore(obj.score),
      difficulty: normalizeDifficulty(obj.difficulty),
      knowledgePoints:
        typeof obj.knowledgePoints === 'string'
          ? normalizeKnowledgePoints(obj.knowledgePoints)
          : '',
      subQuestions: Array.isArray(obj.subQuestions)
        ? obj.subQuestions.map(normalizeSubQuestion)
        : [createSubQuestion()],
    })
  }

  return createStandardQuestion({
    id: typeof obj.id === 'string' && obj.id ? obj.id : undefined,
    stem: typeof obj.stem === 'string' ? obj.stem : '',
    options: normalizeOptionsInput(obj.options),
    score: normalizeScore(obj.score),
    difficulty: normalizeDifficulty(obj.difficulty),
    knowledgePoints:
      typeof obj.knowledgePoints === 'string'
        ? normalizeKnowledgePoints(obj.knowledgePoints)
        : '',
    answer: typeof obj.answer === 'string' ? obj.answer : '',
    analysis: typeof obj.analysis === 'string' ? obj.analysis : '',
    steps: normalizeStepsInput(obj.steps),
  })
}

export function serializeExamJson(doc: ExamDocument): string {
  return JSON.stringify(doc, null, 2)
}

export function parseExamJson(raw: string): ExamDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('JSON 格式解析失败，请检查引号、逗号和括号是否完整。')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 根节点必须是一个包含 title 和 sections 的对象。')
  }

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.sections)) {
    throw new Error('JSON 缺少有效的 sections 大题数组。')
  }

  const sections = obj.sections.map((secRaw) => {
    const sec = secRaw && typeof secRaw === 'object' ? (secRaw as Record<string, unknown>) : {}
    const scoreMode: SectionScoreMode =
      sec.scoreMode === 'uniform' || sec.scoreMode === 'per-question' || sec.scoreMode === 'none'
        ? sec.scoreMode
        : sec.scorePerQuestion
          ? 'uniform'
          : 'none'
    return createSection({
      id: typeof sec.id === 'string' && sec.id ? sec.id : undefined,
      title: typeof sec.title === 'string' && sec.title.trim() ? sec.title.trim() : '未命名大题',
      scoreMode,
      scorePerQuestion: normalizeScore(sec.scorePerQuestion),
      items: Array.isArray(sec.items) ? sec.items.map(normalizeSectionItem) : [],
    })
  })

  return {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : '未命名试卷',
    sections,
  }
}

export function buildAiPromptTemplate(): string {
  return `请将我下面提供的试题内容整理为符合《试卷模板》规范的 JSON 对象（仅输出合法 JSON，不要附加 Markdown 以外的多余解释）。

模板规则要求：
1. 题号从 1 开始全卷连续递增；子母题只占 1 个母题号，子题使用（1）（2）不占位；题组母材料无题号，题组下小题题号与外部连续。
2. 题组必须填写非空 passage（题组题干内容），且题组小题不能包含 difficulty 或 knowledgePoints。
3. difficulty 只能取空字符串 "" 或以下 5 个值之一："容易"、"较易"、"一般"、"较难"、"困难"。
4. knowledgePoints 多个知识点用中文分号 "；" 分隔；无答案/解析/步骤时留空 "" 或 []。
5. section.scoreMode 可选："uniform"（大题标题标每小题分值，需填 scorePerQuestion）、"per-question"（小题自身填 score，格式如 18.（本题10分））、"none"。

JSON Schema 示例：
{
  "title": "2026年高一数学期中测试卷",
  "sections": [
    {
      "title": "选择题",
      "scoreMode": "uniform",
      "scorePerQuestion": 3,
      "items": [
        {
          "kind": "standard",
          "stem": "题干内容",
          "options": [
            { "label": "A", "text": "选项A" },
            { "label": "B", "text": "选项B" },
            { "label": "C", "text": "选项C" },
            { "label": "D", "text": "选项D" }
          ],
          "difficulty": "容易",
          "knowledgePoints": "知识点1；知识点2",
          "answer": "A",
          "analysis": "解析内容",
          "steps": []
        },
        {
          "kind": "compound",
          "stem": "子母题母题题干",
          "difficulty": "一般",
          "knowledgePoints": "函数性质",
          "subQuestions": [
            {
              "stem": "第1问",
              "answer": "答案1",
              "analysis": "解析1",
              "steps": ["第一步...", "第二步..."]
            },
            {
              "stem": "第2问",
              "answer": "答案2",
              "analysis": "解析2",
              "steps": []
            }
          ]
        }
      ]
    },
    {
      "title": "阅读理解",
      "scoreMode": "uniform",
      "scorePerQuestion": 2,
      "items": [
        {
          "kind": "group",
          "delimiterStyle": "chinese-paren",
          "passage": "阅读材料正文（不能为空）",
          "questions": [
            {
              "stem": "小题题干",
              "options": [
                { "label": "A", "text": "选项A" },
                { "label": "B", "text": "选项B" }
              ],
              "answer": "A",
              "analysis": "小题解析"
            }
          ]
        }
      ]
    },
    {
      "title": "解答题",
      "scoreMode": "per-question",
      "items": [
        {
          "kind": "standard",
          "score": 10,
          "stem": "解答题题干",
          "answer": "参考答案",
          "analysis": "解题思路",
          "steps": ["解：设...", "综上所述..."]
        }
      ]
    }
  ]
}

以下是我需要整理的原始试题内容：
`
}
