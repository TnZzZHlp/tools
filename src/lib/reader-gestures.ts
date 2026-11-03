import { watch, type Ref } from 'vue'

interface ReaderGestureOptions {
  layout: Ref<'scroll' | 'paged'>
  toolsVisible: Ref<boolean>
  chapterId: () => string | undefined
  blocked: () => boolean
  busy: () => boolean
  atEnd: () => boolean
  turnPage: (delta: number) => void
  nextChapter: () => void
}

export function useReaderGestures(options: ReaderGestureOptions) {
  let wheelAt = 0
  let wheelDistance = 0
  let wheelStartedAtEnd = false
  let wheelHandled = false
  let touch: { x: number; y: number; atEnd: boolean; moved: boolean } | undefined
  let ignoreClickUntil = 0

  function isControl(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          'button, a, input, select, textarea, [role="dialog"], [role="combobox"], [contenteditable="true"]',
        ),
      )
    )
  }

  function toggleTools(event: MouseEvent) {
    if (
      isControl(event.target) ||
      performance.now() < ignoreClickUntil ||
      window.getSelection()?.toString()
    )
      return
    options.toolsVisible.value = !options.toolsVisible.value
  }

  function onWheel(event: WheelEvent) {
    if (
      isControl(event.target) ||
      options.blocked() ||
      event.ctrlKey ||
      event.metaKey ||
      Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    )
      return
    const now = performance.now()
    if (now - wheelAt > 300) {
      wheelDistance = 0
      wheelStartedAtEnd = options.atEnd()
      wheelHandled = false
    }
    wheelAt = now
    options.toolsVisible.value = false
    if (options.busy()) {
      wheelHandled = true
      return
    }
    const delta =
      event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
    if (options.layout.value === 'scroll') {
      if (delta <= 0 || !options.atEnd()) {
        wheelDistance = 0
        wheelStartedAtEnd = false
        return
      }
      if (wheelHandled) return
      if (!wheelStartedAtEnd) {
        wheelStartedAtEnd = true
        wheelDistance = 0
      }
    } else if (event.cancelable) event.preventDefault()
    if (wheelHandled) return
    if (Math.sign(wheelDistance) !== Math.sign(delta)) wheelDistance = 0
    wheelDistance += delta
    if (Math.abs(wheelDistance) < 80) return
    wheelHandled = true
    if (wheelDistance > 0 && wheelStartedAtEnd && options.atEnd()) options.nextChapter()
    else if (options.layout.value === 'paged') options.turnPage(wheelDistance > 0 ? 1 : -1)
  }

  function onTouchStart(event: TouchEvent) {
    touch = undefined
    if (
      event.touches.length !== 1 ||
      isControl(event.target) ||
      options.blocked() ||
      options.busy()
    )
      return
    const point = event.touches[0]!
    ignoreClickUntil = 0
    touch = { x: point.clientX, y: point.clientY, atEnd: options.atEnd(), moved: false }
  }

  function onTouchMove(event: TouchEvent) {
    if (!touch) return
    if (event.touches.length !== 1) {
      touch = undefined
      return
    }
    const point = event.touches[0]!
    const dx = touch.x - point.clientX
    const dy = touch.y - point.clientY
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      touch.moved = true
      ignoreClickUntil = performance.now() + 500
      options.toolsVisible.value = false
    }
    if (options.busy() || options.blocked()) return
    if (options.layout.value === 'paged') {
      if (touch.moved && event.cancelable) event.preventDefault()
    } else if (
      touch.atEnd &&
      options.atEnd() &&
      dy > 0 &&
      Math.abs(dy) > Math.abs(dx) &&
      event.cancelable
    )
      event.preventDefault()
  }

  function onTouchEnd(event: TouchEvent) {
    const gesture = touch
    touch = undefined
    if (!gesture?.moved || options.busy() || options.blocked()) return
    ignoreClickUntil = performance.now() + 500
    const point = event.changedTouches[0]
    if (!point) return
    const dx = gesture.x - point.clientX
    const dy = gesture.y - point.clientY
    if (options.layout.value === 'paged') {
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (Math.abs(delta) < 64) return
      if (delta > 0 && gesture.atEnd && options.atEnd()) options.nextChapter()
      else options.turnPage(delta > 0 ? 1 : -1)
    } else if (gesture.atEnd && options.atEnd() && dy >= 64 && Math.abs(dy) > Math.abs(dx))
      options.nextChapter()
  }

  function onTouchCancel() {
    touch = undefined
  }

  watch(
    () => [options.chapterId(), options.layout.value],
    () => {
      wheelHandled = true
      touch = undefined
    },
  )
  return { toggleTools, onWheel, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
}
