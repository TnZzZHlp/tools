import { computed, nextTick, shallowRef, watch, type Ref } from 'vue'
import { getColumnSizeMm, type PaperProfile } from '../paper'
import type { AnswerSheetLayoutConfig, AnswerSheetSemanticData } from '../types'
import { measureItems, waitForResources } from './measure'
import type { LayoutItem, LayoutSettings, PaginatedSheetModel } from './model'
import { paginate } from './paginate'
import { initialSettings, prepareItems } from './prepare'

export function useLayoutEngine(
  data: Readonly<Ref<AnswerSheetSemanticData>>,
  paper: Readonly<Ref<PaperProfile>>,
  config?: Readonly<Ref<AnswerSheetLayoutConfig | undefined>>,
  defaults?: Readonly<Ref<Partial<LayoutSettings> | undefined>>,
) {
  const root = shallowRef<HTMLElement>()
  const job = shallowRef<{ entries: LayoutItem[]; settings: LayoutSettings }>()
  const result = shallowRef<PaginatedSheetModel>()
  const busy = shallowRef(false)
  const error = shallowRef('')
  const column = computed(() => getColumnSizeMm(paper.value))
  let sequence = 0
  let activePaper = paper.value

  async function build(settings: LayoutSettings, sequenceAtStart: number) {
    const entries = prepareItems(data.value, paper.value, settings, config?.value)
    job.value = { entries, settings }
    await nextTick()
    if (sequenceAtStart !== sequence || !root.value) return
    await waitForResources(root.value)
    if (sequenceAtStart !== sequence) return
    const measured = measureItems(root.value, entries)
    return paginate(entries, measured, paper.value.columns, column.value.heightMm, settings)
  }

  watch(
    [data, paper, () => config?.value, () => defaults?.value],
    (_, __, onCleanup) => {
      const current = ++sequence
      if (activePaper !== paper.value) result.value = undefined
      activePaper = paper.value
      busy.value = true
      const frame = requestAnimationFrame(async () => {
        try {
          const layout = await build(
            { ...initialSettings(config?.value), ...defaults?.value },
            current,
          )
          if (layout && current === sequence) {
            result.value = layout
            error.value = ''
          }
        } catch (cause) {
          if (current === sequence) {
            result.value = undefined
            error.value = (cause as Error).message
          }
        } finally {
          if (current === sequence) {
            busy.value = false
            job.value = undefined
          }
        }
      })
      onCleanup(() => {
        cancelAnimationFrame(frame)
        sequence++
      })
    },
    { immediate: true, deep: true },
  )

  async function autoFitTargetPages(targetPages: number): Promise<boolean> {
    if (busy.value || !result.value || targetPages < 1) return false
    if (result.value.pages.length <= targetPages) return true
    const previous = result.value.settings
    const current = ++sequence
    const options: LayoutSettings[] = []
    for (let height = previous.lineHeightMm - 0.25; height >= 7; height -= 0.25)
      options.push({ ...previous, lineHeightMm: height })
    const compact = {
      ...(options[options.length - 1] ?? previous),
      gapMm: Math.min(previous.gapMm, 2),
      blockPaddingMm: Math.min(previous.blockPaddingMm, 2),
    }
    options.push(
      compact,
      ...[0.95, 0.9, 0.85]
        .filter((scale) => scale < previous.blankScale)
        .map((blankScale) => ({ ...compact, blankScale })),
    )
    busy.value = true
    try {
      for (const option of options) {
        const layout = await build(option, current)
        if (!layout || current !== sequence) return false
        if (layout.pages.length <= targetPages) {
          result.value = layout
          error.value = ''
          return true
        }
      }
      return false
    } catch {
      return false
    } finally {
      if (current === sequence) {
        busy.value = false
        job.value = undefined
      }
    }
  }

  return { root, job, result, busy, error, column, autoFitTargetPages }
}
