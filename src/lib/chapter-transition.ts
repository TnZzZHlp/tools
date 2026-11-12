import { onBeforeUnmount, ref, watch } from 'vue'
import {
  CONTAINER_MOTION,
  containerEnterScale,
  containerLeaveScale,
  containerOrigin,
  useReducedMotion,
} from '@/lib/container-motion'

export function useChapterTransition() {
  const scope = ref<HTMLElement>()
  const reducedMotion = useReducedMotion()
  const direction = ref(1)
  let animation: Animation | undefined
  let finish: (() => void) | undefined

  function container() {
    return scope.value?.querySelector<HTMLElement>('.reader-content') ?? undefined
  }

  function release() {
    animation?.cancel()
    animation = undefined
    const node = container()
    node?.style.removeProperty('opacity')
    node?.style.removeProperty('transform')
    finish?.()
    finish = undefined
  }

  async function wait(signal: AbortSignal) {
    if (signal.aborted) {
      release()
      return
    }
    signal.addEventListener('abort', release, { once: true })
    try {
      await new Promise<void>((resolve) => {
        finish = resolve
        void animation?.finished.then(
          () => resolve(),
          () => resolve(),
        )
      })
    } finally {
      signal.removeEventListener('abort', release)
    }
  }

  async function leave(signal: AbortSignal, forward: boolean) {
    release()
    direction.value = forward ? 1 : -1
    if (reducedMotion.value || signal.aborted) return
    const node = container()
    if (!node) return
    animation = node.animate(
      [
        { opacity: 1, transform: 'scale(1)', transformOrigin: containerOrigin(node) },
        {
          opacity: 0.55,
          transform: `scale(${containerLeaveScale(direction.value)})`,
          transformOrigin: containerOrigin(node),
        },
      ],
      { duration: CONTAINER_MOTION.leave, easing: 'ease-in', fill: 'both' },
    )
    await wait(signal)
  }

  async function reveal(signal: AbortSignal) {
    release()
    if (reducedMotion.value || signal.aborted) return
    const node = container()
    if (!node) return
    const started = node.animate(
      [
        {
          opacity: 0.55,
          transform: `scale(${containerEnterScale(direction.value)})`,
          transformOrigin: containerOrigin(node),
        },
        { opacity: 1, transform: 'scale(1)', transformOrigin: containerOrigin(node) },
      ],
      { duration: CONTAINER_MOTION.enter, easing: CONTAINER_MOTION.easing, fill: 'both' },
    )
    animation = started
    await wait(signal)
    if (!signal.aborted && animation === started) release()
  }

  watch(reducedMotion, (value) => {
    if (value) release()
  })

  onBeforeUnmount(release)

  return { scope, reducedMotion, leave, reveal, cancel: release }
}
