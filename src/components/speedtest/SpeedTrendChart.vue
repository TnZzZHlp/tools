<script setup lang="ts">
import { computed, useId } from 'vue'
import { cn } from '@/lib/utils'

const WIDTH = 100
const HEIGHT = 40
const PEAK_HEIGHT = HEIGHT * 0.92
const POINT_STRIDE = 2

interface Point {
  x: number
  y: number
}

const props = withDefaults(
  defineProps<{
    samples: readonly number[]
    capacity: number
    marker: number | null
    markerLabel?: string
    tone: 'download' | 'upload'
  }>(),
  {
    markerLabel: '稳定速率',
  },
)

const gradientId = useId()

/** Catmull-Rom spline through points converted to cubic Béziers. */
function curvePath(points: readonly Point[]): string {
  const first = points[0]
  if (!first) return ''
  let d = `M${first.x},${first.y}`
  const last = points.length - 1
  for (let i = 0; i < last; i++) {
    const before = points[Math.max(0, i - 1)]!
    const from = points[i]!
    const to = points[i + 1]!
    const after = points[Math.min(last, i + 2)]!
    const cp1x = from.x + (to.x - before.x) / 6
    const cp1y = from.y + (to.y - before.y) / 6
    const cp2x = to.x - (after.x - from.x) / 6
    const cp2y = to.y - (after.y - from.y) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${to.x},${to.y}`
  }
  return d
}

const peak = computed(() => Math.max(1, props.marker ?? 0, ...props.samples))

const points = computed<Point[]>(() => {
  const len = props.samples.length
  if (len === 0) return []
  const denom = Math.max(1, props.capacity - 1)
  const pointAt = (index: number): Point => ({
    x: (index / denom) * WIDTH,
    y: HEIGHT - ((props.samples[index] ?? 0) / peak.value) * PEAK_HEIGHT,
  })
  const result: Point[] = []
  for (let i = 0; i < len; i += POINT_STRIDE) {
    result.push(pointAt(i))
  }
  if (len > 1 && (len - 1) % POINT_STRIDE !== 0) {
    result.push(pointAt(len - 1))
  }
  return result
})

const line = computed(() => (points.value.length > 1 ? curvePath(points.value) : null))

const areaPath = computed(() => {
  if (!line.value || points.value.length < 2) return null
  const lastX = points.value[points.value.length - 1]?.x ?? 0
  return `${line.value} L${lastX},${HEIGHT} L0,${HEIGHT} Z`
})

const markerY = computed(() => {
  if (props.marker === null || props.marker <= 0) return null
  return HEIGHT - (props.marker / peak.value) * PEAK_HEIGHT
})

const markerTopPercent = computed(() =>
  markerY.value === null ? 0 : (markerY.value / HEIGHT) * 100,
)
</script>

<template>
  <div
    :class="
      cn(
        'relative h-full w-full',
        tone === 'download' ? 'text-accent' : 'text-[var(--p0seid0n-upload)]',
      )
    "
  >
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      aria-hidden="true"
      class="block h-full w-full overflow-visible"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.72" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0.08" />
        </linearGradient>
      </defs>

      <line
        x1="0"
        :y1="HEIGHT"
        :x2="WIDTH"
        :y2="HEIGHT"
        class="stroke-line stroke-1"
        vector-effect="non-scaling-stroke"
      />

      <template v-if="line && areaPath">
        <path :d="areaPath" :fill="`url(#${gradientId})`" />
        <path
          :d="line"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </template>

      <line
        v-if="markerY !== null"
        x1="0"
        :y1="markerY"
        :x2="WIDTH"
        :y2="markerY"
        class="stroke-ink-muted"
        stroke-width="1.25"
        stroke-dasharray="4 3"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <span
      v-if="markerY !== null"
      aria-hidden="true"
      class="pointer-events-none absolute right-3 -translate-y-full pb-1 text-[11px] leading-none font-medium tracking-[0.02em] text-ink-muted"
      :style="{ top: `${markerTopPercent}%` }"
    >
      {{ markerLabel }}
    </span>
  </div>
</template>
