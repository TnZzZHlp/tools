<script setup lang="ts">
import { computed, ref, useAttrs, useId, type StyleValue } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { areaPaths, niceMax, normalizeAreaData, type AreaCurve, type AreaTone } from './geometry'

defineOptions({ inheritAttrs: false })

export type AreaChartProps = {
  /** Single-series numeric input. Ignored when `data` is non-empty. */
  values?: readonly number[]
  /** Tabular multi-series rows. */
  data?: readonly Record<string, unknown>[]
  /** Keys from `data` to plot as areas. */
  categories?: readonly string[]
  /** Key in `data` used for axis and tooltip labels. */
  index?: string
  tone?: AreaTone
  tones?: readonly AreaTone[]
  curve?: AreaCurve
  max?: number
  height?: string
  showGrid?: boolean
  showXAxis?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  valueFormatter?: (value: number) => string
  ariaLabel?: string
}

const props = withDefaults(defineProps<AreaChartProps>(), {
  values: undefined,
  data: undefined,
  categories: undefined,
  index: undefined,
  tone: 'accent',
  tones: undefined,
  curve: 'monotone',
  max: undefined,
  height: '12rem',
  showGrid: true,
  showXAxis: false,
  showLegend: undefined,
  showTooltip: true,
  valueFormatter: undefined,
  ariaLabel: undefined,
})

const chartId = useId()
const activeIndex = ref<number | null>(null)

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  return rest
})

const normalised = computed(() =>
  normalizeAreaData({
    values: props.values,
    data: props.data,
    categories: props.categories,
    index: props.index,
    tone: props.tone,
    tones: props.tones,
  }),
)

const sharedTop = computed(() => {
  const combined: number[] = []
  for (const item of normalised.value.series) {
    for (const val of item.values) combined.push(val)
  }
  return niceMax(combined, props.max)
})

const renderedSeries = computed(() =>
  normalised.value.series.map((item, idx) => ({
    ...item,
    gradientId: `${chartId}-fill-${idx}`,
    ...areaPaths(item.values, {
      max: sharedTop.value,
      curve: props.curve,
      width: 100,
      height: 100,
    }),
  })),
)

const legendVisible = computed(() =>
  props.showLegend !== undefined ? props.showLegend : renderedSeries.value.length > 1,
)

const activeX = computed(() => {
  if (activeIndex.value === null) return 0
  const firstSeries = renderedSeries.value[0]
  return firstSeries?.points[activeIndex.value]?.x ?? 0
})

const activeLabel = computed(() => {
  if (activeIndex.value === null) return ''
  return normalised.value.labels[activeIndex.value] ?? ''
})

const gridLines = [4, 36, 68, 100] as const

function toneTextClass(tone: AreaTone): string {
  if (tone === 'accent-alt') return 'text-accent-alt'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'default') return 'text-ink'
  return 'text-accent'
}

function toneBgClass(tone: AreaTone): string {
  if (tone === 'accent-alt') return 'bg-accent-alt'
  if (tone === 'danger') return 'bg-danger'
  if (tone === 'default') return 'bg-ink'
  return 'bg-accent'
}

function formatValue(value: number): string {
  return props.valueFormatter ? props.valueFormatter(value) : String(value)
}

function onPointerMove(event: PointerEvent): void {
  if (!props.showTooltip || normalised.value.pointCount === 0) return
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const count = normalised.value.pointCount
  activeIndex.value = count <= 1 ? 0 : Math.round(ratio * (count - 1))
}

function onPointerLeave(): void {
  activeIndex.value = null
}

const labelled = computed(() => props.ariaLabel !== undefined)
const xAxisLabels = computed(() => {
  const labels = normalised.value.labels
  if (labels.length === 0) return []
  if (labels.length <= 5) return labels
  const mid = Math.floor((labels.length - 1) / 2)
  return [labels[0] ?? '', labels[mid] ?? '', labels[labels.length - 1] ?? '']
})
</script>

<template>
  <div v-bind="forwarded" :class="cn('flex w-full flex-col gap-3', attrs.class as ClassValue)">
    <div
      v-if="legendVisible && renderedSeries.length > 0"
      class="flex flex-wrap items-center gap-4"
    >
      <div
        v-for="item in renderedSeries"
        :key="item.name"
        class="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"
      >
        <span :class="cn('size-2 rounded-full', toneBgClass(item.tone))" aria-hidden="true" />
        <span>{{ item.name }}</span>
      </div>
    </div>

    <div
      class="relative w-full select-none"
      :style="[{ height: props.height }, attrs.style as StyleValue]"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        class="block size-full overflow-visible"
        :role="labelled ? 'img' : undefined"
        :aria-label="ariaLabel"
        :aria-hidden="labelled ? undefined : 'true'"
      >
        <defs>
          <linearGradient
            v-for="item in renderedSeries"
            :id="item.gradientId"
            :key="item.gradientId"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <g v-if="showGrid" class="text-line">
          <line
            v-for="y in gridLines"
            :key="y"
            x1="0"
            :y1="y"
            x2="100"
            :y2="y"
            stroke="currentColor"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
        </g>

        <g v-for="item in renderedSeries" :key="item.name" :class="toneTextClass(item.tone)">
          <path v-if="item.areaPath" :d="item.areaPath" :fill="`url(#${item.gradientId})`" />
          <path
            v-if="item.linePath"
            :d="item.linePath"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </svg>

      <template v-if="showTooltip && activeIndex !== null && renderedSeries.length > 0">
        <div
          class="pointer-events-none absolute inset-y-0 border-l border-line"
          :style="{ left: `${activeX}%` }"
        />
        <span
          v-for="item in renderedSeries"
          :key="item.name"
          :class="
            cn(
              'pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-raised',
              toneBgClass(item.tone),
            )
          "
          :style="{
            left: `${item.points[activeIndex]?.x ?? 0}%`,
            top: `${item.points[activeIndex]?.y ?? 0}%`,
          }"
        />
        <div
          class="pointer-events-none absolute top-2 z-10 min-w-28 rounded-[10px] border border-line bg-raised px-2.5 py-1.5 text-[12px] shadow-popup"
          :style="
            activeX > 60
              ? { right: `${100 - activeX}%`, marginRight: '8px' }
              : { left: `${activeX}%`, marginLeft: '8px' }
          "
        >
          <div class="mb-1 text-[11px] font-medium text-ink-faint">{{ activeLabel }}</div>
          <div
            v-for="item in renderedSeries"
            :key="item.name"
            class="flex items-center justify-between gap-3"
          >
            <span class="inline-flex items-center gap-1.5 text-ink-muted">
              <span :class="cn('size-1.5 rounded-full', toneBgClass(item.tone))" />
              {{ item.name }}
            </span>
            <span
              class="font-condensed text-[13px] font-medium tracking-[-0.01em] tabular-nums text-ink"
            >
              {{ formatValue(item.values[activeIndex] ?? 0) }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <div
      v-if="showXAxis && xAxisLabels.length > 0"
      class="flex items-center justify-between text-[11px] text-ink-faint"
    >
      <span v-for="(label, idx) in xAxisLabels" :key="`${label}-${idx}`">{{ label }}</span>
    </div>
  </div>
</template>
