import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HeaderBlock from '@/components/answer-sheet/HeaderBlock.vue'
import BlockLabel from '@/components/answer-sheet/blocks/BlockLabel.vue'
import { parseAnswerSheetStream } from '@/lib/answer-sheet/api'
import { clearAnswerSheetDrafts, loadAnswerSheetDraft } from '@/lib/answer-sheet/draft'
import { DEFAULT_SHEET_FONT, SHEET_FONTS } from '@/lib/answer-sheet/fonts'
import { choiceRows } from '@/lib/answer-sheet/layout/flow'
import type { Choice } from '@/lib/answer-sheet/layout/model'
import { previewSamples } from '@/lib/answer-sheet/preview'
import { clearPendingAutoSave, useAnswerSheetStore } from '@/stores/answerSheet'
import AnswerSheetView from '@/views/AnswerSheetView.vue'

function createSseResponse(events: Array<{ event: string; data: unknown }>) {
  const text = events
    .map((item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`)
    .join('')
  const encoded = new TextEncoder().encode(text)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('Answer Sheet Workbench Store & Step 07 Interactions', () => {
  beforeEach(async () => {
    clearPendingAutoSave()
    setActivePinia(createPinia())
    await clearAnswerSheetDrafts()
    vi.restoreAllMocks()
  })

  it('invalidates only affected question group on edit and discards stale review responses', async () => {
    const store = useAnswerSheetStore()
    await store.loadSamplePreset('chinese')

    const q9Group = store.questionGroups.find((g) => g.blockIds.includes('q9'))!
    const q13Group = store.questionGroups.find((g) => g.blockIds.includes('q13'))!
    expect(q9Group).toBeDefined()
    expect(q13Group).toBeDefined()

    // Initially mark both passed
    store.markGroupManualVerified(q9Group.groupId)
    store.markGroupManualVerified(q13Group.groupId)
    expect(store.getGroupReviewState(q9Group).status).toBe('passed')
    expect(store.getGroupReviewState(q13Group).status).toBe('passed')

    // Modify q9 line count -> q9 group becomes 'pending', while q13 group remains 'passed'
    store.adjustBlockLines('q9', 2)
    expect(store.getGroupReviewState(q9Group).status).toBe('pending')
    expect(store.getGroupReviewState(q13Group).status).toBe('passed')

    // Start an async review for q9, then mutate q9 BEFORE the response resolves
    let resolveFetch!: (res: Response) => void
    const pendingFetch = new Promise<Response>((r) => {
      resolveFetch = r
    })
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pendingFetch)

    const staleRevision = store.computeGroupRevision(q9Group)
    const reviewPromise = store.reviewQuestionGroup(q9Group.groupId)

    // Mutate q9 while review is in-flight
    store.adjustBlockLines('q9', 1)
    const newerRevision = store.computeGroupRevision(q9Group)
    expect(newerRevision).not.toBe(staleRevision)

    // Resolve the stale response
    resolveFetch(
      new Response(
        JSON.stringify({
          groupId: q9Group.groupId,
          revision: staleRevision,
          verdict: 'passed',
          issues: [],
        }),
        { status: 200 },
      ),
    )

    await reviewPromise
    // Stale response MUST NOT overwrite the newer pending status!
    expect(store.getGroupReviewState(q9Group).status).toBe('pending')
    expect(store.getGroupReviewState(q9Group).revision).toBe(newerRevision)
  })

  it('preserves semantic data and per-paper overrides when switching across A3_3COL / A3_2COL / 8K_2COL', async () => {
    const store = useAnswerSheetStore()
    await store.loadSamplePreset('physics')

    // Adjust block q6 height on A3_2COL
    expect(store.activePaperSpec).toBe('A3_2COL')
    store.setBlockHeightMm('q6', 135)
    expect(store.currentPaperOverrides.blockOverrides.q6?.manualHeightMm).toBe(135)

    // Switch to A3_3COL and customize q6 height to 95mm
    store.switchPaperSpec('A3_3COL')
    expect(store.activePaperSpec).toBe('A3_3COL')
    expect(store.currentPaperOverrides.blockOverrides.q6?.manualHeightMm).toBeUndefined()
    store.setBlockHeightMm('q6', 95)
    expect(store.currentPaperOverrides.blockOverrides.q6?.manualHeightMm).toBe(95)

    // Switch to 8K_2COL with custom dimensions
    store.switchPaperSpec('8K_2COL', { widthMm: 368, heightMm: 258 })
    expect(store.activePaperSpec).toBe('8K_2COL')
    expect(store.activePaperProfile.widthMm).toBe(368)
    expect(store.activePaperProfile.heightMm).toBe(258)

    // Switch back to A3_2COL -> original 135mm override is intact
    store.switchPaperSpec('A3_2COL')
    expect(store.currentPaperOverrides.blockOverrides.q6?.manualHeightMm).toBe(135)
  })

  it('supports immutable Undo / Redo across content, block conversion, and layout adjustments', async () => {
    const store = useAnswerSheetStore()
    await store.loadSamplePreset('chinese')

    const originalTitle = store.semanticData!.meta.title
    store.setTitle('2027届高三第一次摸底联考语文')
    expect(store.semanticData!.meta.title).toBe('2027届高三第一次摸底联考语文')

    // Convert lined_writing q13 to open_blank_box
    store.changeBlockType('q13', 'open_blank_box')
    expect(store.semanticData!.blocks.find((b) => b.id === 'q13')?.type).toBe('open_blank_box')

    // Resize q13 height
    store.setBlockHeightMm('q13', 92)
    expect(store.currentPaperOverrides.blockOverrides.q13?.manualHeightMm).toBe(92)

    // Undo height change
    expect(store.undo()).toBe(true)
    expect(store.currentPaperOverrides.blockOverrides.q13?.manualHeightMm).toBeUndefined()

    // Undo block type conversion
    expect(store.undo()).toBe(true)
    expect(store.semanticData!.blocks.find((b) => b.id === 'q13')?.type).toBe('lined_writing')

    // Undo title change
    expect(store.undo()).toBe(true)
    expect(store.semanticData!.meta.title).toBe(originalTitle)

    // Redo all three steps
    expect(store.redo()).toBe(true)
    expect(store.semanticData!.meta.title).toBe('2027届高三第一次摸底联考语文')
    expect(store.redo()).toBe(true)
    expect(store.semanticData!.blocks.find((b) => b.id === 'q13')?.type).toBe('open_blank_box')
    expect(store.redo()).toBe(true)
    expect(store.currentPaperOverrides.blockOverrides.q13?.manualHeightMm).toBe(92)
  })

  it('parses SSE stream with stage updates and asset chunks, and persists/restores offline without backend calls', async () => {
    const store = useAnswerSheetStore()
    const svgBytes = btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"></svg>')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createSseResponse([
        {
          event: 'stage_update',
          data: { stage: 'normalizing', progress: 35, message: '正在提取公式与配图...' },
        },
        {
          event: 'asset_chunk',
          data: {
            assetId: 'IMG_01',
            chunkIndex: 0,
            chunkCount: 1,
            dataBase64: svgBytes,
          },
        },
        {
          event: 'completed',
          data: {
            semanticData: previewSamples.physics,
            questionGroups: [
              {
                groupId: 'g-phys-4',
                displayNo: '第 4 题',
                sourceMarkdown: '实验题原文',
                sourceAssetIds: ['IMG_01'],
                blockIds: ['q4'],
              },
            ],
            sourceImages: [
              {
                assetId: 'IMG_01',
                mimeType: 'image/svg+xml',
                widthPx: 240,
                heightPx: 120,
              },
            ],
          },
        },
      ]),
    )

    const ok = await store.submitOnboardingParse(
      { type: 'text', text: '物理测试试卷文本' },
      'physics',
    )
    expect(ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(store.semanticData?.meta.subject).toBe('physics')
    expect(store.assetBlobs.IMG_01).toBeInstanceOf(Blob)

    // Modify layout & explicitly save
    store.switchPaperSpec('8K_2COL')
    await store.persistDraftToLocal(true)

    // Verify local draft storage has everything
    const stored = await loadAnswerSheetDraft()
    expect(stored).not.toBeNull()
    expect(stored?.draft.layoutConfig?.activePaperSpec).toBe('8K_2COL')
    expect(stored?.assets).toHaveLength(1)

    // Simulate reopening workbench when backend API is completely offline
    fetchSpy.mockRejectedValue(new Error('Network offline'))
    const freshPinia = createPinia()
    setActivePinia(freshPinia)
    const reopenedStore = useAnswerSheetStore()
    const restored = await reopenedStore.restoreFromIndexedDB()

    expect(restored).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // No backend GET/POST requests made during restore!
    expect(reopenedStore.semanticData?.meta.title).toBe(previewSamples.physics.meta.title)
    expect(reopenedStore.activePaperSpec).toBe('8K_2COL')
    expect(reopenedStore.assetBlobs.IMG_01).toBeInstanceOf(Blob)
  })

  it('delivers a parsed question even if the stream ends before the whole paper is complete', async () => {
    const onQuestionParsed = vi.fn()
    const question = {
      questionIndex: 1,
      group: {
        groupId: 'g2',
        displayNo: '2',
        sourceMarkdown: '第 2 题',
        sourceAssetIds: [],
        blockIds: [],
      },
      blocks: [],
      assets: [],
      sourceImages: [],
      issues: [],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      createSseResponse([{ event: 'question_parsed', data: question }]),
    )

    await expect(
      parseAnswerSheetStream({ type: 'text', text: '不完整流测试' }, 'chinese', {
        onQuestionParsed,
      }),
    ).rejects.toThrow(/未收到完成事件/)
    expect(onQuestionParsed).toHaveBeenCalledExactlyOnceWith(question)
  })

  it('mounts AnswerSheetView with local answer sheet list, new sheet creation, and right global sidebar inline parse progress', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/tools/answer-sheet', component: AnswerSheetView },
      ],
    })
    await router.push('/tools/answer-sheet')
    await router.isReady()

    const wrapper = mount(AnswerSheetView, {
      global: {
        plugins: [pinia, router],
      },
    })

    // Wait for initializeWorkbench (no built-in sample is auto-loaded when local storage is empty)
    await new Promise((r) => setTimeout(r, 20))
    await wrapper.vm.$nextTick()

    const store = useAnswerSheetStore()
    expect(store.semanticData).toBeNull()
    expect(store.sheetList).toHaveLength(0)

    expect(wrapper.text()).toContain('答题卡列表')
    expect(wrapper.text()).toContain('新建答题卡')
    expect(wrapper.text()).toContain('新建答题卡并选择试卷文件')
    expect(wrapper.text()).toContain('全局答题卡设置')
    expect(wrapper.text()).toContain('试卷文件与智能解析')
    expect(wrapper.text()).not.toContain('快速切换标准样卷')

    // Click A3 三栏 button to switch paper spec
    const a3ThreeColBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'A3 三栏')
    expect(a3ThreeColBtn).toBeDefined()
    await a3ThreeColBtn!.trigger('click')
    expect(store.activePaperSpec).toBe('A3_3COL')

    // Simulate creating a new answer sheet by selecting an exam file and streaming progress in right global sidebar
    let resolveStream!: (res: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      new Promise<Response>((r) => {
        resolveStream = r
      }),
    )

    const testFile = new File(['mock exam docx'], '2027届高三联考语文试卷.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const createPromise = store.createNewAnswerSheet(testFile)
    await new Promise((r) => setTimeout(r, 20))
    await wrapper.vm.$nextTick()

    // While parsing, right global sidebar shows live progress inline (not a modal dialog)
    expect(store.isParsing).toBe(true)
    expect(store.sheetList).toHaveLength(1)
    expect(wrapper.find('[aria-label="试卷解析进度"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在保存本地原始试卷草稿...')

    resolveStream(
      createSseResponse([
        {
          event: 'stage_update',
          data: { stage: 'ai_parsing', progress: 60, message: '正在识别大题结构...' },
        },
        {
          event: 'completed',
          data: {
            semanticData: previewSamples.weekend,
            questionGroups: [],
            sourceImages: [],
          },
        },
      ]),
    )

    await createPromise
    await wrapper.vm.$nextTick()

    expect(store.isParsing).toBe(false)
    expect(store.semanticData?.meta.title).toBe(previewSamples.weekend.meta.title)
    expect(store.sheetList).toHaveLength(1)
    expect(store.sheetList[0]?.title).toBe(previewSamples.weekend.meta.title)
    expect(wrapper.text()).toContain('质检与总分核查')
  })

  it('matches reference PDF styling: vertical 4-row OMR columns,顿号 label punctuation, and 10-column ID grid table', async () => {
    // 1. Verify HeaderBlock in barcode mode & id_grid mode
    const barcodeHeader = mount(HeaderBlock, {
      props: {
        meta: previewSamples.weekend.meta,
        columnWidthMm: 179.7,
      },
    })
    expect(barcodeHeader.text()).toContain('班级:')
    expect(barcodeHeader.text()).toContain('注意事项:')
    expect(barcodeHeader.find('.barcode-cells').exists()).toBe(true)

    const idGridHeader = mount(HeaderBlock, {
      props: {
        meta: { ...previewSamples.chinese.meta, headerMode: 'id_grid' },
        columnWidthMm: 179.7,
      },
    })
    expect(idGridHeader.find('.id-title').text()).toBe('准 考 证 号')
    expect(idGridHeader.findAll('.id-column')).toHaveLength(10)
    expect(idGridHeader.findAll('.id-write-cell')).toHaveLength(10)

    // 2. Verify BlockLabel formats question numbers with 顿号 and half-width score parentheses
    const label4 = mount(BlockLabel, { props: { displayNo: '4', score: 4 } })
    expect(label4.text()).toBe('4、(4分)')
    const labelSub = mount(BlockLabel, { props: { displayNo: '13(1)', score: 4 } })
    expect(labelSub.text()).toBe('13(1)、(4分)')

    // 3. Verify OMR choiceRows packs questions in 4-row vertical columns matching 2027+届高三语文周末作业试题.pdf
    const weekendChoices = previewSamples.weekend.blocks.filter(
      (b): b is Choice => b.type === 'omr_choice',
    )
    const { rows } = choiceRows(weekendChoices, 179.7, 2)
    // First 4 rows are group 1 ("阅读与运用"):
    // Row 0 has questions 1, 7, 15, 24
    // Row 1 has questions 2, 10 (A-H 2-col span), 19, 25
    expect(rows[0]?.entries.map((e) => e.block.displayNo)).toEqual(['1', '7', '15', '24'])
    expect(rows[1]?.entries.map((e) => e.block.displayNo)).toEqual(['2', '10', '19', '25'])
    expect(rows[2]?.entries.map((e) => e.block.displayNo)).toEqual(['3', '11', '22', '26'])
    expect(rows[3]?.entries.map((e) => e.block.displayNo)).toEqual(['6', '12', '23', '27'])
    // Group 2 ("选择题综合"):
    expect(rows[4]?.entries.map((e) => e.block.displayNo)).toEqual(['28', '32', '36', '40'])
    expect(rows[5]?.entries.map((e) => e.block.displayNo)).toEqual(['29', '33', '37', '41'])

    // 4. Verify Gaokao printing font stack is default
    expect(DEFAULT_SHEET_FONT).toBe('gaokaoPrint')
    expect(SHEET_FONTS[DEFAULT_SHEET_FONT].family).toContain('Times New Roman')
    expect(SHEET_FONTS[DEFAULT_SHEET_FONT].family).toContain('FZShuSong-Z01')
    expect(SHEET_FONTS[DEFAULT_SHEET_FONT].family).toContain('Noto Serif SC Variable')
  })
})
