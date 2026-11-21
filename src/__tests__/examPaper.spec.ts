import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ExamPaperPreview from '@/components/exam-paper/ExamPaperPreview.vue'
import { tabIndicator, tabPanel } from '@/components/ui/tabs/styles'
import { buildExamDocxBytes, buildExamDocumentXml } from '@/lib/exam-paper/docxBuilder'
import { parseExamDocx, parseExamJson, parseExamPdf, parseExamText } from '@/lib/exam-paper/parser'
import { createSampleExamDocument } from '@/lib/exam-paper/presets'
import {
  buildRenderedParagraphs,
  computePaperNumbering,
  computePaperStats,
  formatGroupDelimiter,
  normalizeKnowledgePoints,
  renderExamPlainText,
  splitEmbeddedOptions,
  toChineseNumeral,
  validateExamDocument,
} from '@/lib/exam-paper/render'
import {
  createCompoundQuestion,
  createGroupChildQuestion,
  createQuestionGroup,
  createSection,
  createStandardQuestion,
  createSubQuestion,
  type ExamDocument,
} from '@/lib/exam-paper/types'
import { readZipEntries } from '@/lib/exam-paper/zip'
import ExamPaperView from '@/views/ExamPaperView.vue'

describe('exam-paper helpers & numbering', () => {
  it('formats Chinese numerals, group delimiters, and knowledge points', () => {
    expect(toChineseNumeral(1)).toBe('一')
    expect(toChineseNumeral(10)).toBe('十')
    expect(toChineseNumeral(11)).toBe('十一')
    expect(toChineseNumeral(23)).toBe('二十三')

    expect(formatGroupDelimiter('chinese-paren', 1)).toBe('（一）')
    expect(formatGroupDelimiter('chinese-section', 2)).toBe('第二节')
    expect(formatGroupDelimiter('uppercase-letter', 3)).toBe('C')

    expect(normalizeKnowledgePoints('函数; 集合，不等式；\n单调性、')).toBe(
      '函数；集合；不等式；单调性',
    )
  })

  it('maintains global continuous numbering across standard, compound, and group questions', () => {
    const q1 = createStandardQuestion({ stem: '第1题' })
    const q2 = createCompoundQuestion({
      stem: '第2题母题',
      subQuestions: [createSubQuestion({ stem: '子题1' }), createSubQuestion({ stem: '子题2' })],
    })
    const g1Child1 = createGroupChildQuestion({ stem: '阅读题1' })
    const g1Child2 = createGroupChildQuestion({ stem: '阅读题2' })
    const group1 = createQuestionGroup({
      passage: '阅读材料A',
      questions: [g1Child1, g1Child2],
    })
    const g2Child1 = createGroupChildQuestion({ stem: '阅读题3' })
    const group2 = createQuestionGroup({
      passage: '阅读材料B',
      questions: [g2Child1],
    })
    const q6 = createStandardQuestion({ stem: '填空题', score: 10 })

    const doc: ExamDocument = {
      title: '测试试卷',
      sections: [
        createSection({
          title: '选择题',
          scoreMode: 'uniform',
          scorePerQuestion: 3,
          items: [q1, q2],
        }),
        createSection({
          title: '阅读理解',
          scoreMode: 'uniform',
          scorePerQuestion: 2,
          items: [group1, group2],
        }),
        createSection({ title: '解答题', scoreMode: 'per-question', items: [q6] }),
      ],
    }

    const { questionNumbers, groupIndexes } = computePaperNumbering(doc)
    expect(questionNumbers.get(q1.id)).toBe(1)
    expect(questionNumbers.get(q2.id)).toBe(2)
    expect(questionNumbers.get(g1Child1.id)).toBe(3)
    expect(questionNumbers.get(g1Child2.id)).toBe(4)
    expect(questionNumbers.get(g2Child1.id)).toBe(5)
    expect(questionNumbers.get(q6.id)).toBe(6)

    expect(groupIndexes.get(group1.id)).toBe(1)
    expect(groupIndexes.get(group2.id)).toBe(2)
  })
})

describe('exam-paper rendering & validation', () => {
  it('omits empty tags and formats options, compound steps, group exclusions, and per-question scores', () => {
    const doc: ExamDocument = {
      title: '期中测试',
      sections: [
        createSection({
          title: '选择题',
          scoreMode: 'uniform',
          scorePerQuestion: 3,
          items: [
            createStandardQuestion({
              stem: '下列值为 2 的是',
              options: [
                { label: 'A', text: '1+1' },
                { label: 'B', text: '1+2' },
                { label: 'C', text: '1+3' },
                { label: 'D', text: '1+4' },
              ],
              difficulty: '',
              knowledgePoints: '',
              answer: 'A',
              analysis: '',
              steps: [],
            }),
            createCompoundQuestion({
              stem: '母题题干',
              difficulty: '较难',
              knowledgePoints: '函数；导数',
              subQuestions: [
                createSubQuestion({
                  stem: '第一问',
                  answer: '1',
                  analysis: '第一问解析',
                  steps: ['步骤甲', '步骤乙'],
                }),
                createSubQuestion({
                  stem: '第二问',
                  answer: '2',
                  analysis: '第二问解析',
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
              delimiterStyle: 'uppercase-letter',
              passage: 'Passage content here.',
              questions: [
                createGroupChildQuestion({
                  stem: 'Child question',
                  options: [
                    { label: 'A', text: 'opt1' },
                    { label: 'B', text: 'opt2' },
                  ],
                  answer: 'A',
                  analysis: 'Child analysis',
                }),
              ],
            }),
          ],
        }),
        createSection({
          title: '解答题',
          scoreMode: 'per-question',
          items: [
            createStandardQuestion({
              stem: '计算结果',
              score: 10,
              answer: '42',
            }),
          ],
        }),
      ],
    }

    const paragraphs = buildRenderedParagraphs(doc)
    const lines = paragraphs.map((p) => p.text)

    expect(lines[0]).toBe('期中测试')
    expect(lines).toContain('一、选择题（每小题3分）')
    expect(lines).toContain('1.下列值为 2 的是')
    expect(lines).toContain('A.1+1')
    expect(lines).toContain('B.1+2')
    expect(lines).toContain('C.1+3')
    expect(lines).toContain('D.1+4')
    const q1Start = lines.indexOf('1.下列值为 2 的是')
    const q2Start = lines.indexOf('2.母题题干')
    const q1Lines = lines.slice(q1Start, q2Start)
    expect(q1Lines.some((line) => line.startsWith('【难度】'))).toBe(false)
    expect(q1Lines.some((line) => line.startsWith('【知识点】'))).toBe(false)
    expect(q1Lines.some((line) => line.startsWith('【解析】'))).toBe(false)

    // Compound sub-question steps appear immediately after their sub-question analysis
    const sub1AnalysisIdx = lines.indexOf('（1）第一问解析')
    expect(sub1AnalysisIdx).toBeGreaterThan(-1)
    expect(lines[sub1AnalysisIdx + 1]).toBe('【步骤1】步骤甲')
    expect(lines[sub1AnalysisIdx + 2]).toBe('【步骤2】步骤乙')
    expect(lines[sub1AnalysisIdx + 3]).toBe('（2）第二问解析')

    // Group section
    expect(lines).toContain('A')
    expect(lines).toContain('Passage content here.')
    expect(lines).toContain('3.Child question')
    expect(lines).toContain('A.opt1')
    expect(lines).toContain('B.opt2')

    // Per-question score dot uses half-width before （本题10分）
    expect(lines).toContain('4.（本题10分）计算结果')
  })

  it('validates missing title, empty group passage, and warning conditions', () => {
    const doc: ExamDocument = {
      title: ' ',
      sections: [
        createSection({
          title: '阅读理解',
          scoreMode: 'uniform',
          scorePerQuestion: undefined,
          items: [
            createQuestionGroup({
              passage: '',
              questions: [
                createGroupChildQuestion({
                  stem: '题干',
                  analysis: '',
                  steps: ['第一步'],
                }),
              ],
            }),
          ],
        }),
      ],
    }

    const issues = validateExamDocument(doc)
    const codes = issues.map((item) => item.code)
    expect(codes).toContain('empty-title')
    expect(codes).toContain('missing-uniform-score')
    expect(codes).toContain('empty-group-passage')
    expect(codes).toContain('steps-without-analysis')

    const passageIssue = issues.find((item) => item.code === 'empty-group-passage')
    expect(passageIssue?.severity).toBe('error')
  })

  it('splits embedded A/B/C/D options pasted into a stem textarea', () => {
    const vertical = splitEmbeddedOptions(
      '下列选项正确的是（ ）\nA．甲项\nB．乙项\nC．丙项\nD．丁项',
    )
    expect(vertical).toEqual({
      stem: '下列选项正确的是（ ）',
      options: [
        { label: 'A', text: '甲项' },
        { label: 'B', text: '乙项' },
        { label: 'C', text: '丙项' },
        { label: 'D', text: '丁项' },
      ],
    })

    const twoCols = splitEmbeddedOptions('计算结果为（ ）\nA. 1    B. 2\nC. 3    D. 4')
    expect(twoCols?.options.length).toBe(4)

    expect(splitEmbeddedOptions('这是一道没有选项的填空题________。')).toBeNull()
  })
})

describe('exam-paper docx builder & parser round-trip', () => {
  it('builds a valid OOXML docx archive with A4 geometry and XML escaping', async () => {
    const sample = createSampleExamDocument()
    const firstItem = sample.sections[0]?.items[0]
    if (firstItem && firstItem.kind === 'standard') {
      firstItem.stem = '比较 a < b & c > d 的大小 "test"'
    }

    const docXml = buildExamDocumentXml(sample)
    expect(docXml).toContain('a &lt; b &amp; c &gt; d')
    expect(docXml).toContain('<w:pgSz w:w="11906" w:h="16838"/>')
    expect(docXml).toContain(
      '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/>',
    )
    expect(docXml).toContain('<w:docGrid w:type="lines" w:linePitch="312"/>')

    const bytes = buildExamDocxBytes(sample)
    expect(bytes[0]).toBe(0x50) // 'P'
    expect(bytes[1]).toBe(0x4b) // 'K'
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)

    const entries = await readZipEntries(bytes)
    expect(entries.has('[Content_Types].xml')).toBe(true)
    expect(entries.has('_rels/.rels')).toBe(true)
    expect(entries.has('word/_rels/document.xml.rels')).toBe(true)
    expect(entries.has('word/document.xml')).toBe(true)
    expect(entries.has('word/styles.xml')).toBe(true)
    expect(entries.has('word/settings.xml')).toBe(true)
    expect(entries.has('word/fontTable.xml')).toBe(true)
    expect(entries.has('docProps/core.xml')).toBe(true)
    expect(entries.has('docProps/app.xml')).toBe(true)

    const reparsed = await parseExamDocx(bytes)
    expect(reparsed.title).toBe(sample.title)
    expect(reparsed.sections.length).toBe(sample.sections.length)
    expect(computePaperStats(reparsed).questionCount).toBe(computePaperStats(sample).questionCount)
    expect(renderExamPlainText(reparsed)).toBe(renderExamPlainText(sample))
  })

  it('parses the reference 试卷模板文件 (1).docx accurately without stray hidden characters', async () => {
    const templatePath = resolve(process.cwd(), '试卷模板文件 (1).docx')
    const fileBytes = new Uint8Array(readFileSync(templatePath))
    const parsed = await parseExamDocx(fileBytes)

    expect(parsed.title).toBe('请在此处输入试卷名称')
    expect(parsed.sections.map((s) => s.title)).toEqual(['选择题', '阅读理解', '填空题', '解答题'])
    expect(parsed.sections[0]?.scoreMode).toBe('uniform')
    expect(parsed.sections[0]?.scorePerQuestion).toBe(3)
    expect(parsed.sections[3]?.scoreMode).toBe('per-question')

    // Total continuous question numbers across all 4 sections: 1..25
    const stats = computePaperStats(parsed)
    expect(stats.questionCount).toBe(25)
    expect(stats.groupCount).toBe(2)

    // Compound question 2 has resolved （1） and （2） answers and analyses via numPr
    const q2 = parsed.sections[0]?.items[1]
    expect(q2?.kind).toBe('compound')
    const q2Compound = q2 as Extract<NonNullable<typeof q2>, { kind: 'compound' }>
    expect(q2Compound.subQuestions.length).toBe(2)
    expect(q2Compound.subQuestions[0]?.answer).toContain('小题答案')
    expect(q2Compound.subQuestions[1]?.analysis).toContain('解析')

    // Stray white '[' must not appear in section header
    expect(renderExamPlainText(parsed)).not.toContain('一、选择题（每小题3分）[')
  })

  it('parses the reference 1.pdf exam paper with multi-line title, 7 sections, 40 questions, blanks, and sub-questions', async () => {
    const pdfPath = resolve(process.cwd(), '1.pdf')
    const pdfBytes = new Uint8Array(readFileSync(pdfPath))
    const parsed = await parseExamPdf(pdfBytes)

    expect(parsed.title).toBe(
      '文学院2025-2026学年（1）学期期末考试 《中国古代文学（1）》试卷（A卷）',
    )
    expect(parsed.sections.map((s) => s.title)).toEqual([
      '单项选择题',
      '多项选择题',
      '填空',
      '词语解释',
      '简答题',
      '诗歌赏析题',
      '论述题',
    ])
    expect(parsed.sections.map((s) => s.scorePerQuestion)).toEqual([1, 2, 1, 4, 5, 10, 12])

    const stats = computePaperStats(parsed)
    expect(stats.sectionCount).toBe(7)
    expect(stats.questionCount).toBe(40)
    expect(stats.totalScore).toBe(100)

    const q1 = parsed.sections[0]?.items[0] as Extract<
      NonNullable<(typeof parsed.sections)[0]>['items'][0],
      { kind: 'standard' }
    >
    expect(q1.kind).toBe('standard')
    expect(q1.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(q1.options[0]?.text).toBe('《吕氏春秋》')
    expect(q1.options[1]?.text).toBe('《山海经》')

    const q15 = parsed.sections[0]?.items[14] as Extract<
      NonNullable<(typeof parsed.sections)[0]>['items'][0],
      { kind: 'standard' }
    >
    expect(q15.stem).toContain('千古情语之祖')

    const q16 = parsed.sections[1]?.items[0] as Extract<
      NonNullable<(typeof parsed.sections)[1]>['items'][0],
      { kind: 'standard' }
    >
    expect(q16.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D', 'E'])

    const q21 = parsed.sections[2]?.items[0] as Extract<
      NonNullable<(typeof parsed.sections)[2]>['items'][0],
      { kind: 'standard' }
    >
    const q26 = parsed.sections[2]?.items[5] as Extract<
      NonNullable<(typeof parsed.sections)[2]>['items'][0],
      { kind: 'standard' }
    >
    expect(q21.stem).toContain('我东曰归，______。')
    expect(q26.stem).toContain('包括《______》《夏书》《商书》和《周书》四部分')

    const q31 = parsed.sections[3]?.items[0] as Extract<
      NonNullable<(typeof parsed.sections)[3]>['items'][0],
      { kind: 'compound' }
    >
    expect(q31.kind).toBe('compound')
    expect(q31.subQuestions.length).toBe(2)
    expect(q31.subQuestions[0]?.stem).toBe('微：')
    expect(q31.subQuestions[1]?.stem).toBe('亢：')

    const q38 = parsed.sections[5]?.items[0] as Extract<
      NonNullable<(typeof parsed.sections)[5]>['items'][0],
      { kind: 'standard' }
    >
    expect(q38.stem).toContain('桃之夭夭、灼灼其华。之子于归、宜其室家。\n桃之夭夭、有蕡其实。')
    expect(q38.stem.endsWith('思想观念。')).toBe(true)

    const errors = validateExamDocument(parsed).filter((issue) => issue.severity === 'error')
    expect(errors).toEqual([])
  })

  it('parses LLM JSON without ids and plain text templates', () => {
    const jsonDoc = parseExamJson(
      JSON.stringify({
        title: 'AI 组卷测试',
        sections: [
          {
            title: '选择题',
            scoreMode: 'uniform',
            scorePerQuestion: 5,
            items: [
              {
                stem: '1+1=?',
                options: ['A．1', 'B．2'],
                difficulty: '容易',
                answer: 'B',
              },
            ],
          },
        ],
      }),
    )

    expect(jsonDoc.title).toBe('AI 组卷测试')
    expect(jsonDoc.sections[0]?.items[0]?.kind).toBe('standard')

    const textDoc = parseExamText(
      [
        '随堂小测',
        '一、选择题（每小题4分）',
        '1．题干内容',
        'A．甲',
        'B．乙',
        '【难度】一般',
        '【知识点】基础；逻辑',
        '【答案】A',
      ].join('\n'),
    )
    expect(textDoc.title).toBe('随堂小测')
    expect(textDoc.sections[0]?.scorePerQuestion).toBe(4)
    expect(computePaperStats(textDoc).totalScore).toBe(4)
  })
})

describe('ExamPaperView UX', () => {
  it('supports manual authoring accelerators, undo, live preview sync, and docx export', async () => {
    if (typeof window.localStorage?.clear === 'function') {
      window.localStorage.clear()
    }
    const createObjectURLSpy = vi.fn(() => 'blob:mock-docx')
    const revokeObjectURLSpy = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLSpy, configurable: true })

    const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
    expect(routerSource).toMatch(
      /path:\s*'\/tools\/exam-paper'[^}]*?meta:\s*\{\s*fullscreen:\s*true\s*\}/,
    )

    const wrapper = mount(ExamPaperView, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })

    try {
      expect(wrapper.classes()).toContain('lg:h-[100dvh]')
      expect(wrapper.find('a[href="/"]').exists()).toBe(true)
      expect((wrapper.get('#exam-title').element as HTMLInputElement).value).toContain('2026年')
      expect(wrapper.text()).toContain('排版实时预览')

      // Update paper title and verify live preview updates
      await wrapper.get('#exam-title').setValue('单元测试专用试卷')
      expect(wrapper.text()).toContain('单元测试专用试卷')

      // Symbol bar is removed and 【答案】【难度】【知识点】【解析】 are hidden from the question area by default
      const editorRegion = wrapper.get('[aria-label="试题聚焦编辑区"]')
      expect(editorRegion.text()).not.toContain('【答案】')
      expect(editorRegion.text()).not.toContain('【难度】')
      expect(editorRegion.text()).not.toContain('【知识点】')
      expect(editorRegion.text()).not.toContain('【解析】')
      expect(wrapper.findAll('button').find((btn) => btn.text().trim() === '±')).toBeUndefined()
      expect(
        editorRegion.findAll('button').find((btn) => btn.text().trim() === '较难'),
      ).toBeUndefined()

      // Open 高级设置 and toggle 【难度】 & 【答案】 ON
      const advancedBtn = wrapper.findAll('button').find((btn) => btn.text().includes('高级设置'))
      expect(advancedBtn).toBeDefined()
      await advancedBtn?.trigger('click')
      await nextTick()

      const diffSwitch = document.getElementById('advanced-field-difficulty') as HTMLElement | null
      const ansSwitch = document.getElementById('advanced-field-answer') as HTMLElement | null
      expect(diffSwitch).not.toBeNull()
      expect(ansSwitch).not.toBeNull()
      expect(diffSwitch?.getAttribute('data-state')).toBe('unchecked')
      expect(ansSwitch?.getAttribute('data-state')).toBe('unchecked')

      diffSwitch?.click()
      ansSwitch?.click()
      await nextTick()

      const hardPill = editorRegion.findAll('button').find((btn) => btn.text().trim() === '较难')
      expect(hardPill).toBeDefined()
      await hardPill?.trigger('click')
      expect(wrapper.text()).toContain('【难度】较难')

      const answerBPill = editorRegion.findAll('button').find((btn) => btn.text().trim() === 'B')
      expect(answerBPill).toBeDefined()
      await answerBPill?.trigger('click')
      expect(wrapper.text()).toContain('【答案】B')

      // Toggle 【难度】 back OFF: hidden in question editor, non-destructive to data
      diffSwitch?.click()
      await nextTick()
      expect(
        editorRegion.findAll('button').find((btn) => btn.text().trim() === '较难'),
      ).toBeUndefined()
      expect(wrapper.text()).toContain('【难度】较难')

      // Rapid-entry "+ 新增下一题 (Ctrl+Enter)" adds a new question and updates numbering
      const addNextBtn = wrapper.findAll('button').find((btn) => btn.text().includes('新增下一题'))
      expect(addNextBtn).toBeDefined()
      await addNextBtn?.trigger('click')
      expect(wrapper.text()).toContain('10 题')

      // Undo restores question count back to 9
      const undoBtn = wrapper.findAll('button').find((btn) => btn.text().includes('撤销'))
      expect(undoBtn).toBeDefined()
      await undoBtn?.trigger('click')
      expect(wrapper.text()).toContain('9 题')

      // Export .docx downloads generated file
      const exportBtn = wrapper.findAll('button').find((btn) => btn.text().includes('导出 .docx'))
      expect(exportBtn).toBeDefined()
      await exportBtn?.trigger('click')

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
      expect(clickSpy).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
      clickSpy.mockRestore()
    }
  })

  it('keeps Tabs indicator valid and renders formatted preview without plain-text tab', async () => {
    expect(tabIndicator).not.toContain('reka-tabs-indicator-thickness')
    expect(tabIndicator).toContain('top-1 bottom-1')
    expect(tabPanel).toContain('data-[state=inactive]:hidden')

    const sample = createSampleExamDocument()
    const wrapper = mount(ExamPaperPreview, {
      props: {
        doc: sample,
        errorCount: 0,
        warningCount: 0,
      },
    })

    expect(wrapper.findAll('[role="tab"]').length).toBe(0)
    expect(wrapper.text()).not.toContain('纯文本')
    expect(wrapper.text()).toContain('排版实时预览')
    expect(wrapper.text()).toContain(sample.title)
  })
})
