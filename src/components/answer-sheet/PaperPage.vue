<script setup lang="ts">
import { computed } from 'vue'
import { getColumnSizeMm, type PaperProfile } from '@/lib/answer-sheet/paper'
import './paper.css'
import './reference.css'

const props = defineProps<{
  profile: PaperProfile
  page: number
  totalPages: number
  referenceStyle?: boolean
}>()
const column = computed(() => getColumnSizeMm(props.profile))
const anchors = computed(() => {
  const { widthMm, marginsMm } = props.profile
  return [marginsMm.left, widthMm - marginsMm.right - 5.82]
})
const markInset = computed(() => Math.max(8, props.profile.marginsMm.top - 8.2))
const bottomMarkY = computed(() =>
  Math.min(
    props.profile.heightMm - 13.8,
    props.profile.heightMm - props.profile.marginsMm.bottom + 2.4,
  ),
)
</script>

<template>
  <article
    class="sheet-page"
    :style="{ width: `${profile.widthMm}mm`, height: `${profile.heightMm}mm` }"
    :aria-label="`第 ${page} 面`"
  >
    <svg
      class="sheet-marks"
      :viewBox="`0 0 ${profile.widthMm} ${profile.heightMm}`"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
    >
      <template v-for="y in [markInset, bottomMarkY]" :key="y">
        <rect
          v-for="x in anchors"
          :key="x"
          :x="x"
          :y="y"
          width="5.82"
          height="5.82"
          stroke="none"
        />
      </template>
      <!-- Top-left horizontal 4-box page identification marks -->
      <g data-page-mark>
        <rect
          v-for="index in 4"
          :key="index"
          :x="profile.marginsMm.left + 13.2 + (index - 1) * 6.35"
          :y="markInset + 1.15"
          width="4.5"
          height="2.4"
          :fill="(page & (1 << (index - 1))) !== 0 ? 'currentColor' : 'none'"
          stroke-width="0.22"
        />
      </g>
    </svg>
    <div
      class="sheet-columns"
      :style="{
        inset: `${profile.marginsMm.top}mm ${profile.marginsMm.right}mm ${profile.marginsMm.bottom}mm ${profile.marginsMm.left}mm`,
        gridTemplateColumns: `repeat(${profile.columns}, minmax(0, 1fr))`,
        gap: `${profile.columnGapMm}mm`,
      }"
    >
      <section v-for="index in profile.columns" :key="index" class="sheet-column">
        <slot :index="index - 1" :column-width-mm="column.widthMm" />
      </section>
    </div>
    <footer
      class="sheet-footer"
      :class="{ 'single-col-footer': profile.columns === 1 }"
      :style="{
        bottom: `${profile.heightMm - bottomMarkY - 5.2}mm`,
        ...(profile.columns > 1
          ? {
              right: `calc(${((profile.columns - 1) / profile.columns) * 100}% + ${profile.columnGapMm / 2 + 5}mm)`,
            }
          : { insetInline: `${profile.marginsMm.left}mm ${profile.marginsMm.right}mm` }),
      }"
    >
      第 {{ page }} 面 共 {{ totalPages }} 面
    </footer>
  </article>
</template>

<style scoped>
.sheet-page {
  position: relative;
}
.sheet-marks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.sheet-columns {
  position: absolute;
  display: grid;
}
.sheet-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sheet-gap, 0mm);
}
.sheet-footer {
  position: absolute;
  bottom: 7.2mm;
  text-align: right;
  font-size: 9pt;
}
.single-col-footer {
  text-align: center;
}
</style>
