import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export function loadPdfPreview(bytes: Uint8Array) {
  const base = `${import.meta.env.BASE_URL}pdf-assets/`
  return getDocument({
    data: bytes,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    iccUrl: `${base}iccs/`,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    stopAtErrors: true,
    enableXfa: false,
  })
}

let queue: Promise<unknown> = Promise.resolve()

export function renderThumbnail(
  document: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
) {
  let cancelled = false
  let cancelRender: (() => void) | undefined
  const done = queue
    .catch(() => {})
    .then(async () => {
      if (cancelled) return
      const page = await document.getPage(pageNumber)
      if (cancelled) return
      const original = page.getViewport({ scale: 1 })
      const scale = Math.min(220 / original.width, 280 / original.height)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const task = page.render({ canvas, viewport })
      cancelRender = () => task.cancel()
      try {
        await task.promise
      } finally {
        page.cleanup()
      }
    })
  queue = done
  return {
    done,
    cancel() {
      cancelled = true
      cancelRender?.()
    },
  }
}
