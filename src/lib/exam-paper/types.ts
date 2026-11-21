export const DIFFICULTY_LEVELS = ['容易', '较易', '一般', '较难', '困难'] as const

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]

export type SectionScoreMode = 'uniform' | 'per-question' | 'none'

export type GroupDelimiterStyle = 'chinese-paren' | 'chinese-section' | 'uppercase-letter'

export interface QuestionOption {
  label: string
  text: string
}

export interface StandardQuestionItem {
  id: string
  kind: 'standard'
  stem: string
  options: QuestionOption[]
  score?: number
  difficulty: DifficultyLevel | ''
  knowledgePoints: string
  answer: string
  analysis: string
  steps: string[]
}

export interface SubQuestion {
  id: string
  stem: string
  options: QuestionOption[]
  answer: string
  analysis: string
  steps: string[]
}

export interface CompoundQuestionItem {
  id: string
  kind: 'compound'
  stem: string
  score?: number
  subQuestions: SubQuestion[]
  difficulty: DifficultyLevel | ''
  knowledgePoints: string
}

export interface GroupChildQuestion {
  id: string
  stem: string
  options: QuestionOption[]
  score?: number
  answer: string
  analysis: string
  steps: string[]
}

export interface QuestionGroupItem {
  id: string
  kind: 'group'
  delimiterStyle: GroupDelimiterStyle
  passage: string
  questions: GroupChildQuestion[]
}

export type SectionItem = StandardQuestionItem | CompoundQuestionItem | QuestionGroupItem

export interface ExamSection {
  id: string
  title: string
  scoreMode: SectionScoreMode
  scorePerQuestion?: number
  items: SectionItem[]
}

export interface ExamDocument {
  title: string
  sections: ExamSection[]
}

let idCounter = 0

export function createId(prefix = 'id'): string {
  idCounter += 1
  const rand = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${idCounter}-${rand}`
}

export function createOption(label: string, text = ''): QuestionOption {
  return { label, text }
}

export function createDefaultOptions(): QuestionOption[] {
  return ['A', 'B', 'C', 'D'].map((label) => createOption(label, ''))
}

export function createStandardQuestion(
  partial: Partial<Omit<StandardQuestionItem, 'kind'>> = {},
): StandardQuestionItem {
  return {
    id: partial.id ?? createId('q'),
    kind: 'standard',
    stem: partial.stem ?? '',
    options: partial.options ? partial.options.map((opt) => ({ ...opt })) : [],
    score: partial.score,
    difficulty: partial.difficulty ?? '',
    knowledgePoints: partial.knowledgePoints ?? '',
    answer: partial.answer ?? '',
    analysis: partial.analysis ?? '',
    steps: partial.steps ? [...partial.steps] : [],
  }
}

export function createSubQuestion(partial: Partial<SubQuestion> = {}): SubQuestion {
  return {
    id: partial.id ?? createId('sub'),
    stem: partial.stem ?? '',
    options: partial.options ? partial.options.map((opt) => ({ ...opt })) : [],
    answer: partial.answer ?? '',
    analysis: partial.analysis ?? '',
    steps: partial.steps ? [...partial.steps] : [],
  }
}

export function createCompoundQuestion(
  partial: Partial<Omit<CompoundQuestionItem, 'kind'>> = {},
): CompoundQuestionItem {
  return {
    id: partial.id ?? createId('cq'),
    kind: 'compound',
    stem: partial.stem ?? '',
    score: partial.score,
    subQuestions: partial.subQuestions
      ? partial.subQuestions.map((sub) => createSubQuestion(sub))
      : [createSubQuestion(), createSubQuestion()],
    difficulty: partial.difficulty ?? '',
    knowledgePoints: partial.knowledgePoints ?? '',
  }
}

export function createGroupChildQuestion(
  partial: Partial<GroupChildQuestion> = {},
): GroupChildQuestion {
  return {
    id: partial.id ?? createId('gq'),
    stem: partial.stem ?? '',
    options: partial.options ? partial.options.map((opt) => ({ ...opt })) : [],
    score: partial.score,
    answer: partial.answer ?? '',
    analysis: partial.analysis ?? '',
    steps: partial.steps ? [...partial.steps] : [],
  }
}

export function createQuestionGroup(
  partial: Partial<Omit<QuestionGroupItem, 'kind'>> = {},
): QuestionGroupItem {
  return {
    id: partial.id ?? createId('grp'),
    kind: 'group',
    delimiterStyle: partial.delimiterStyle ?? 'chinese-paren',
    passage: partial.passage ?? '',
    questions: partial.questions
      ? partial.questions.map((q) => createGroupChildQuestion(q))
      : [createGroupChildQuestion(), createGroupChildQuestion()],
  }
}

export function createSection(partial: Partial<ExamSection> = {}): ExamSection {
  return {
    id: partial.id ?? createId('sec'),
    title: partial.title ?? '选择题',
    scoreMode: partial.scoreMode ?? 'uniform',
    scorePerQuestion: partial.scorePerQuestion,
    items: partial.items ? [...partial.items] : [],
  }
}
