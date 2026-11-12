import { nextTick } from 'vue'
import type { Router } from 'vue-router'

export const MORPH_SOURCE_ATTRIBUTE = 'data-morph'
export const MORPH_TARGET_ATTRIBUTE = 'data-morph-target'

const MORPH_NAME = 'morph'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<unknown> | void) => { finished: Promise<void> }
}

export function supportsViewTransition() {
  return typeof document !== 'undefined' && 'startViewTransition' in document
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function releaseName(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) return
  element.style.removeProperty('view-transition-name')
  element.removeAttribute('data-morph-active')
}

function claimName(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) return
  element.style.setProperty('view-transition-name', MORPH_NAME)
  element.setAttribute('data-morph-active', '')
}

function destination() {
  return document.querySelector(`[${MORPH_TARGET_ATTRIBUTE}]`)
}

async function waitForDestination(attempts: number) {
  for (let index = 0; index < attempts; index += 1) {
    await nextTick()
    const element = destination()
    if (element) return element
    await new Promise<void>((resolve) => setTimeout(resolve, 16))
  }
  return destination()
}

function sourceOf(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>(`[${MORPH_SOURCE_ATTRIBUTE}]`)
    : null
}

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function sourceHref(source: HTMLElement) {
  const explicit = source.getAttribute(MORPH_SOURCE_ATTRIBUTE)
  if (explicit) return explicit
  return source.closest('a[href]')?.getAttribute('href') ?? null
}

export function installRouteMorph(router: Router) {
  const doc = document as ViewTransitionDocument
  if (!doc.startViewTransition) return () => undefined
  const startViewTransition = doc.startViewTransition.bind(doc)

  let navigating = false

  function onClick(event: MouseEvent) {
    if (navigating || event.defaultPrevented || !isPlainLeftClick(event)) return
    const source = sourceOf(event.target)
    const href = source ? sourceHref(source) : null
    if (!source || !href) return
    if (prefersReducedMotion()) return
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return
    if (url.pathname === window.location.pathname && url.search === window.location.search) return

    event.preventDefault()
    event.stopPropagation()
    navigating = true
    document.documentElement.setAttribute('data-morphing', '')
    claimName(source)

    function release() {
      releaseName(source)
      releaseName(document.querySelector('[data-morph-active]'))
      document.documentElement.removeAttribute('data-morphing')
      navigating = false
    }

    try {
      const transition = startViewTransition(async () => {
        await router.push(url.pathname + url.search + url.hash)
        claimName(await waitForDestination(3))
      })
      void transition.finished.finally(release)
    } catch {
      release()
      void router.push(url.pathname + url.search + url.hash)
    }
  }

  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}
