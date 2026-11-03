import { onBeforeUnmount, ref, watch } from 'vue'

type AnimatedElement = Element
type ChapterLayout = 'scroll' | 'paged'

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

function clearMotionStyles(scope: HTMLElement | undefined) {
  for (const element of scope?.querySelectorAll<HTMLElement>('[data-chapter-motion]') || []) {
    element.style.removeProperty('opacity')
    element.style.removeProperty('transform')
    element.style.removeProperty('clip-path')
  }
}

export function useChapterTransition() {
  const scope = ref<HTMLElement>()
  const reducedMotion = ref(reducedMotionQuery.matches)
  const phase = ref<'idle' | 'leaving' | 'revealing'>('idle')
  const direction = ref(1)
  const layout = ref<ChapterLayout>('scroll')
  let animations: Animation[] = []
  let finish: (() => void) | undefined

  function play(
    elements: AnimatedElement[],
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    return elements.map((element) => element.animate(keyframes, { fill: 'both', ...options }))
  }

  function cancel() {
    for (const animation of animations) animation.cancel()
    animations = []
    clearMotionStyles(scope.value)
    phase.value = 'idle'
    finish?.()
    finish = undefined
  }

  async function settle() {
    if (!animations.length) return
    await Promise.all(
      animations.map((animation) =>
        animation.finished.then(
          () => undefined,
          () => undefined,
        ),
      ),
    )
  }

  async function wait(signal: AbortSignal) {
    if (signal.aborted) {
      cancel()
      return
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      await new Promise<void>((resolve) => {
        finish = resolve
        void settle().then(() => resolve())
      })
    } finally {
      signal.removeEventListener('abort', cancel)
    }
  }

  async function leave(signal: AbortSignal, forward: boolean, readingLayout: ChapterLayout) {
    cancel()
    direction.value = forward ? 1 : -1
    layout.value = readingLayout
    if (reducedMotion.value || signal.aborted || !scope.value) return
    phase.value = 'leaving'
    animations = play(
      Array.from(scope.value.querySelectorAll('[data-chapter-motion]')),
      [
        {
          opacity: '1',
          transform: layout.value === 'scroll' ? 'translateY(0px)' : 'translateX(0px)',
        },
        {
          opacity: '0.15',
          transform:
            layout.value === 'scroll'
              ? `translateY(${-direction.value * 16}px)`
              : `translateX(${-direction.value * 6}px)`,
        },
      ],
      { duration: 180, easing: 'ease-in' },
    )
    await wait(signal)
  }

  async function reveal(signal: AbortSignal) {
    cancel()
    if (reducedMotion.value || signal.aborted || !scope.value) return
    phase.value = 'revealing'
    const inset = direction.value === 1 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
    const beam = scope.value.querySelector<HTMLElement>('.reader-transition-beam')
    const vertical = layout.value === 'scroll'
    const distance = vertical
      ? beam?.parentElement?.clientHeight || 0
      : beam?.parentElement?.clientWidth || 0
    const axis = vertical ? 'Y' : 'X'
    animations = play(
      Array.from(scope.value.querySelectorAll('[data-chapter-motion]')),
      [
        {
          opacity: vertical ? '0.2' : '0.55',
          transform: vertical
            ? `translateY(${direction.value * 28}px)`
            : `translateX(${direction.value * 10}px)`,
          clipPath: vertical ? undefined : inset,
        },
        {
          opacity: '1',
          transform: vertical ? 'translateY(0px)' : 'translateX(0px)',
          clipPath: vertical ? undefined : 'inset(0 0 0 0)',
        },
      ],
      { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    if (beam)
      animations.push(
        ...play(
          [beam],
          [
            {
              transform:
                direction.value === 1
                  ? `translate${axis}(${distance}px)`
                  : `translate${axis}(-96px)`,
              opacity: '0',
            },
            { offset: 0.5, opacity: '0.45' },
            {
              transform:
                direction.value === 1
                  ? `translate${axis}(-96px)`
                  : `translate${axis}(${distance}px)`,
              opacity: '0',
            },
          ],
          { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        ),
      )
    await wait(signal)
    if (!signal.aborted) cancel()
  }

  function onReducedMotionChange(event: MediaQueryListEvent) {
    reducedMotion.value = event.matches
  }

  reducedMotionQuery.addEventListener('change', onReducedMotionChange)
  onBeforeUnmount(() => {
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
    cancel()
  })
  watch(reducedMotion, (value) => {
    if (value) cancel()
  })
  return { scope, phase, direction, layout, leave, reveal, cancel }
}
