import { ref, watch, type Ref } from 'vue'

export function useSelectScroll(list: Readonly<Ref<HTMLElement | null>>) {
  const canScrollUp = ref(false)
  const canScrollDown = ref(false)

  watch(
    list,
    (element, _, onCleanup) => {
      if (!element) {
        canScrollUp.value = canScrollDown.value = false
        return
      }

      function update() {
        if (!element) return
        canScrollUp.value = element.scrollTop > 1
        canScrollDown.value = element.scrollHeight - element.clientHeight - element.scrollTop > 1
      }

      const resize = new ResizeObserver(update)
      const mutation = new MutationObserver(update)
      resize.observe(element)
      mutation.observe(element, { childList: true, subtree: true, characterData: true })
      element.addEventListener('scroll', update, { passive: true })
      onCleanup(() => {
        resize.disconnect()
        mutation.disconnect()
        element.removeEventListener('scroll', update)
      })
      update()
    },
    { flush: 'post' },
  )

  function scroll(direction: -1 | 1) {
    list.value?.scrollBy({ top: direction * 36 })
  }

  return { canScrollUp, canScrollDown, scroll }
}
