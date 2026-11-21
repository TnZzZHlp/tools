import { parseExamJson, serializeExamJson } from './parser'
import {
  createCompoundQuestion,
  createGroupChildQuestion,
  createQuestionGroup,
  createSection,
  createStandardQuestion,
  createSubQuestion,
  type ExamDocument,
  type ExamSection,
} from './types'

export const DRAFT_STORAGE_KEY = 'tools:exam-paper:draft-v1'

export interface SectionPreset {
  id: string
  label: string
  create: () => ExamSection
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'choice',
    label: '选择题',
    create: () =>
      createSection({
        title: '选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [
          createStandardQuestion({
            options: [
              { label: 'A', text: '' },
              { label: 'B', text: '' },
              { label: 'C', text: '' },
              { label: 'D', text: '' },
            ],
          }),
        ],
      }),
  },
  {
    id: 'multi-choice',
    label: '多选题',
    create: () =>
      createSection({
        title: '多项选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 4,
        items: [
          createStandardQuestion({
            options: [
              { label: 'A', text: '' },
              { label: 'B', text: '' },
              { label: 'C', text: '' },
              { label: 'D', text: '' },
            ],
          }),
        ],
      }),
  },
  {
    id: 'reading-group',
    label: '阅读理解 / 题组',
    create: () =>
      createSection({
        title: '阅读理解',
        scoreMode: 'uniform',
        scorePerQuestion: 2,
        items: [
          createQuestionGroup({
            delimiterStyle: 'chinese-paren',
            passage: '',
            questions: [
              createGroupChildQuestion({
                options: [
                  { label: 'A', text: '' },
                  { label: 'B', text: '' },
                  { label: 'C', text: '' },
                  { label: 'D', text: '' },
                ],
              }),
              createGroupChildQuestion({
                options: [
                  { label: 'A', text: '' },
                  { label: 'B', text: '' },
                  { label: 'C', text: '' },
                  { label: 'D', text: '' },
                ],
              }),
            ],
          }),
        ],
      }),
  },
  {
    id: 'fill-blank',
    label: '填空题',
    create: () =>
      createSection({
        title: '填空题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [createStandardQuestion()],
      }),
  },
  {
    id: 'essay',
    label: '解答题',
    create: () =>
      createSection({
        title: '解答题',
        scoreMode: 'per-question',
        items: [createStandardQuestion({ score: 10 })],
      }),
  },
  {
    id: 'custom',
    label: '自定义大题',
    create: () =>
      createSection({
        title: '综合题',
        scoreMode: 'none',
        items: [createStandardQuestion()],
      }),
  },
]

export function createSampleExamDocument(): ExamDocument {
  return {
    title: '2026年秋季学期高一年级数学阶段性检测卷',
    sections: [
      createSection({
        title: '选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [
          createStandardQuestion({
            stem: '已知集合 A = {x | -1 < x < 3}，B = {0, 1, 2, 3}，则 A ∩ B 等于（ ）',
            options: [
              { label: 'A', text: '{0, 1, 2}' },
              { label: 'B', text: '{1, 2}' },
              { label: 'C', text: '{0, 1, 2, 3}' },
              { label: 'D', text: '{-1, 0, 1, 2}' },
            ],
            difficulty: '容易',
            knowledgePoints: '集合的交集；集合的表示方法',
            answer: 'A',
            analysis: '由区间定义可知 A 中包含整数 0、1、2，不包含端点 3，因此 A ∩ B = {0, 1, 2}。',
            steps: [],
          }),
          createCompoundQuestion({
            stem: '已知二次函数 f(x) = x² - 2ax + 3 在区间 [1, 4] 上单调变化，回答下列两问：',
            difficulty: '一般',
            knowledgePoints: '二次函数单调性；二次函数最值',
            subQuestions: [
              createSubQuestion({
                stem: '若 f(x) 在区间 [1, 4] 上单调递增，求实数 a 的取值范围。',
                answer: 'a ≤ 1',
                analysis:
                  '抛物线开口向上，对称轴为 x = a。要使函数在 [1, 4] 上单调递增，需对称轴位于区间左端点左侧。',
                steps: [
                  '确定函数 f(x) = (x - a)² + 3 - a² 的对称轴为 x = a。',
                  '结合开口向上性质，令 a ≤ 1，即得实数 a 的取值范围为 (-∞, 1]。',
                ],
              }),
              createSubQuestion({
                stem: '当 a = 2 时，求函数 f(x) 在 [1, 4] 上的最大值与最小值。',
                answer: '最小值为 -1，最大值为 3',
                analysis: '当 a = 2 时，对称轴 x = 2 ∈ [1, 4]，分别比较顶点及两端点函数值即可。',
                steps: [],
              }),
            ],
          }),
        ],
      }),
      createSection({
        title: '阅读理解',
        scoreMode: 'uniform',
        scorePerQuestion: 2,
        items: [
          createQuestionGroup({
            delimiterStyle: 'chinese-paren',
            passage:
              '阅读下面材料：在日常数据统计中，中位数与平均数常用于刻画样本的集中趋势。当样本中存在极端值时，中位数往往比平均数更具稳健性。某学习小组 7 名同学一周课外阅读时长（单位：小时）分别为 4, 5, 5, 6, 7, 8, 14。',
            questions: [
              createGroupChildQuestion({
                stem: '该组阅读时长数据的中位数是（ ）',
                options: [
                  { label: 'A', text: '5' },
                  { label: 'B', text: '6' },
                  { label: 'C', text: '7' },
                  { label: 'D', text: '8' },
                ],
                answer: 'B',
                analysis: '共有 7 个已按从小到大排列的数据，第 4 个数据为 6，故中位数是 6。',
              }),
              createGroupChildQuestion({
                stem: '该组阅读时长数据的平均数是（ ）',
                options: [
                  { label: 'A', text: '6' },
                  { label: 'B', text: '6.5' },
                  { label: 'C', text: '7' },
                  { label: 'D', text: '7.5' },
                ],
                answer: 'C',
                analysis: '总和为 4 + 5 + 5 + 6 + 7 + 8 + 14 = 49，平均数为 49 ÷ 7 = 7。',
              }),
            ],
          }),
          createQuestionGroup({
            delimiterStyle: 'chinese-paren',
            passage:
              '继续考察上述学习小组：若组内阅读时长为 14 小时的同学因参加竞赛记录调整为 7 小时，其余 6 名同学时长保持不变。',
            questions: [
              createGroupChildQuestion({
                stem: '调整后该组数据的众数是（ ）',
                options: [
                  { label: 'A', text: '5' },
                  { label: 'B', text: '6' },
                  { label: 'C', text: '7' },
                  { label: 'D', text: '5 和 7' },
                ],
                answer: 'D',
                analysis:
                  '调整后数据为 4, 5, 5, 6, 7, 7, 8，其中 5 和 7 均出现 2 次，故众数为 5 和 7。',
              }),
              createGroupChildQuestion({
                stem: '调整后保持不变的数字特征是（ ）',
                options: [
                  { label: 'A', text: '平均数' },
                  { label: 'B', text: '方差' },
                  { label: 'C', text: '中位数' },
                  { label: 'D', text: '极差' },
                ],
                answer: 'C',
                analysis: '调整后有序数列第 4 项仍为 6，因此中位数保持不变。',
              }),
            ],
          }),
        ],
      }),
      createSection({
        title: '填空题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [
          createStandardQuestion({
            stem: '函数 y = √(x - 2) 的定义域为________。',
            difficulty: '容易',
            knowledgePoints: '函数定义域',
            answer: '[2, +∞)',
            analysis: '二次根式被开方数非负，即 x - 2 ≥ 0，解得 x ≥ 2。',
          }),
          createStandardQuestion({
            stem: '若 log₂(x + 1) = 3，则实数 x 的值为________。',
            difficulty: '较易',
            knowledgePoints: '对数运算',
            answer: '7',
            analysis: '由对数与指数互化可得 x + 1 = 2³ = 8，故 x = 7。',
          }),
        ],
      }),
      createSection({
        title: '解答题',
        scoreMode: 'per-question',
        items: [
          createStandardQuestion({
            stem: '已知等差数列 {aₙ} 满足 a₁ = 2，a₄ = 11，求数列 {aₙ} 的通项公式及前 n 项和 Sₙ。',
            score: 10,
            difficulty: '一般',
            knowledgePoints: '等差数列通项公式；等差数列前n项和',
            answer: 'aₙ = 3n - 1；Sₙ = n(3n + 1)/2',
            analysis: '先根据首项与第四项求出公差 d，再代入通项与求和公式。',
            steps: [
              '设等差数列公差为 d，由 a₄ = a₁ + 3d 得 11 = 2 + 3d，解得 d = 3。',
              '所以通项公式为 aₙ = 2 + 3(n - 1) = 3n - 1。',
              '前 n 项和 Sₙ = n(a₁ + aₙ)/2 = n(2 + 3n - 1)/2 = n(3n + 1)/2。',
            ],
          }),
        ],
      }),
    ],
  }
}

export function createEmptyExamDocument(): ExamDocument {
  return {
    title: '未命名试卷',
    sections: [
      createSection({
        title: '选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: [
          createStandardQuestion({
            options: [
              { label: 'A', text: '' },
              { label: 'B', text: '' },
              { label: 'C', text: '' },
              { label: 'D', text: '' },
            ],
          }),
        ],
      }),
    ],
  }
}

export function createMathSkeletonDocument(): ExamDocument {
  const makeChoice = () =>
    createStandardQuestion({
      options: [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ],
    })

  return {
    title: '阶段性综合测试卷',
    sections: [
      createSection({
        title: '选择题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: Array.from({ length: 5 }, () => makeChoice()),
      }),
      createSection({
        title: '填空题',
        scoreMode: 'uniform',
        scorePerQuestion: 3,
        items: Array.from({ length: 3 }, () => createStandardQuestion()),
      }),
      createSection({
        title: '解答题',
        scoreMode: 'per-question',
        items: Array.from({ length: 2 }, () => createStandardQuestion({ score: 10 })),
      }),
    ],
  }
}

export function loadDraftDocument(): ExamDocument | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    return parseExamJson(raw)
  } catch {
    return null
  }
}

export function saveDraftDocument(doc: ExamDocument): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serializeExamJson(doc))
  } catch {
    // Ignore storage quota or private mode errors.
  }
}

export function clearDraftDocument(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
