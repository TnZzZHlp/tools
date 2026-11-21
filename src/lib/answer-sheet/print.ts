import { onScopeDispose, watch, type Ref } from 'vue'
import { waitForResources } from './layout/measure'
import type { PaperSize } from './types'

export function usePrintPageSize(size: Readonly<Ref<PaperSize>>) {
  const style = document.createElement('style')
  style.media = 'print'
  document.head.append(style)
  watch(
    size,
    ({ widthMm, heightMm }) => {
      style.textContent = [widthMm, heightMm].every((value) => Number.isFinite(value) && value > 0)
        ? `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`
        : ''
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => style.remove())
}

export async function printAnswerSheet(
  root: HTMLElement,
  isCurrent: () => boolean,
): Promise<boolean> {
  await waitForResources(root)
  if (!isCurrent() || !root.isConnected) return false
  if (Array.from(root.querySelectorAll('img')).some((img) => img.naturalWidth === 0)) {
    throw new Error('打印配图加载失败。')
  }
  window.print()
  return true
}
