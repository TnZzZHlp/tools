<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ content: string; paged: boolean; page: number }>()
const emit = defineEmits<{ layout: [pages: number, changed: boolean] }>()
const viewport = ref<HTMLElement>()
const article = ref<HTMLElement>()
const pages = ref(1)
const blocks = computed(() => {
  let start = 0
  return props.content
    .split(/\r?\n\s*\r?\n/)
    .filter((text) => text.trim())
    .map((text) => {
      const block = { text, start }
      start += text.length
      return block
    })
})
const length = computed(() => blocks.value.reduce((sum, block) => sum + block.text.length, 0))
let observer: ResizeObserver | undefined
let frame = 0
let measuredLayout = ''
let measuredContent = ''

function step() {
  return (viewport.value?.clientWidth || 0) + 32
}
function displayPage() {
  if (viewport.value) viewport.value.scrollLeft = props.paged ? props.page * step() : 0
}
function measure() {
  if (!viewport.value || !article.value) return
  const lastBlock = blocks.value.at(-1)
  const end = lastBlock ? rangeAt(lastBlock.start + lastBlock.text.trimEnd().length - 1) : null
  pages.value =
    props.paged && end
      ? Math.max(
          1,
          Math.floor(
            (end.left -
              viewport.value.getBoundingClientRect().left +
              viewport.value.scrollLeft +
              1) /
              step(),
          ) + 1,
        )
      : 1
  displayPage()
  const style = getComputedStyle(article.value)
  const metrics = [
    props.paged,
    viewport.value.clientWidth,
    viewport.value.clientHeight,
    article.value.scrollWidth,
    article.value.scrollHeight,
    style.font,
    ...Array.from(article.value.children, (paragraph) => (paragraph as HTMLElement).offsetHeight),
  ].join(':')
  const changed = measuredLayout !== metrics || measuredContent !== props.content
  measuredLayout = metrics
  measuredContent = props.content
  emit('layout', pages.value, changed)
}
function scheduleMeasure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measure)
}
function observeLayout() {
  observer?.disconnect()
  if (viewport.value) observer?.observe(viewport.value)
  if (article.value) {
    observer?.observe(article.value)
    for (const paragraph of article.value.children) observer?.observe(paragraph)
  }
}
function rangeAt(offset: number) {
  const index = Math.max(0, Math.min(length.value - 1, offset))
  const blockIndex = blocks.value.findIndex((block) => index < block.start + block.text.length)
  const block = blocks.value[blockIndex]
  const node = article.value?.children[blockIndex]?.firstChild
  if (!block || !node || node.nodeType !== Node.TEXT_NODE) return null
  const range = document.createRange()
  range.setStart(node, index - block.start)
  range.setEnd(node, index - block.start + 1)
  return range.getBoundingClientRect()
}
function pageForOffset(offset: number) {
  const rect = rangeAt(offset)
  if (!rect || !viewport.value) return 0
  return Math.max(
    0,
    Math.min(
      pages.value - 1,
      Math.floor(
        (rect.left - viewport.value.getBoundingClientRect().left + viewport.value.scrollLeft + 1) /
          step(),
      ),
    ),
  )
}
function capture() {
  let low = 0
  let high = Math.max(0, length.value - 1)
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const before = props.paged
      ? pageForOffset(middle) < props.page
      : (rangeAt(middle)?.bottom ?? 0) <= 104
    if (before) low = middle + 1
    else high = middle
  }
  return low
}
function restore(offset: number) {
  if (!props.paged) {
    const rect = rangeAt(offset)
    window.scrollTo({
      top: offset === 0 ? 0 : Math.max(0, window.scrollY + (rect?.top || 104) - 104),
      behavior: 'instant',
    })
  }
}
watch(() => props.page, displayPage, { flush: 'post' })
watch(
  () => [props.content, props.paged],
  async () => {
    await nextTick()
    observeLayout()
    measure()
  },
)
onMounted(() => {
  observer = new ResizeObserver(scheduleMeasure)
  observeLayout()
  document.fonts.addEventListener('loadingdone', scheduleMeasure)
  void document.fonts.ready.then(() => {
    if (viewport.value?.isConnected) scheduleMeasure()
  })
  measure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.fonts.removeEventListener('loadingdone', scheduleMeasure)
  cancelAnimationFrame(frame)
})
defineExpose({ capture, restore, pageForOffset, length, measure })
</script>

<template>
  <div ref="viewport" class="reader-text-viewport" :class="{ 'is-paged': paged }">
    <article ref="article" class="reader-text">
      <p v-for="(block, index) in blocks" :key="index">{{ block.text }}</p>
    </article>
  </div>
</template>

<style scoped>
.reader-text-viewport {
  min-width: 0;
}
.reader-text {
  font-family: var(--reader-font);
  font-size: var(--reader-font-size);
  font-weight: var(--reader-font-weight, 400);
  line-height: var(--reader-line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.reader-text p {
  margin: 0 0 var(--reader-paragraph-gap);
  orphans: 2;
  widows: 2;
}
.reader-text p:last-child {
  margin-bottom: 0;
}
.is-paged {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.is-paged .reader-text {
  height: 100%;
  column-width: auto;
  column-count: 1;
  column-gap: 32px;
  column-fill: auto;
}
</style>
