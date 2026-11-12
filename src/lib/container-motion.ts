import { onBeforeUnmount, ref } from 'vue'

export type ContainerLayout = 'scroll' | 'paged'

export const CONTAINER_MOTION = {
  enter: 260,
  leave: 160,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  scale: {
    forward: 0.97,
    backward: 1.03,
  },
} as const

export function containerOrigin(node: HTMLElement) {
  const rect = node.getBoundingClientRect()
  const y = Math.min(Math.max(window.innerHeight / 2 - rect.top, 0), rect.height)
  return `${rect.width / 2}px ${y}px`
}

export function containerEnterScale(direction: number) {
  return direction === 1 ? CONTAINER_MOTION.scale.forward : CONTAINER_MOTION.scale.backward
}

export function containerLeaveScale(direction: number) {
  return direction === 1 ? CONTAINER_MOTION.scale.backward : CONTAINER_MOTION.scale.forward
}

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export function useReducedMotion() {
  const reducedMotion = ref(reducedMotionQuery.matches)
  const onChange = (event: MediaQueryListEvent) => {
    reducedMotion.value = event.matches
  }
  reducedMotionQuery.addEventListener('change', onChange)
  onBeforeUnmount(() => reducedMotionQuery.removeEventListener('change', onChange))
  return reducedMotion
}
