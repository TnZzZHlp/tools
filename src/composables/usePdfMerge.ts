import { computed, markRaw, onBeforeUnmount, ref, type Raw } from 'vue'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { inspectPdf, mergePdfs, normalizeRotation, pdfErrorMessage } from '@/lib/pdf/merge'
import { loadPdfPreview } from '@/lib/pdf/preview'

export interface PdfEntry {
  id: number
  file: File
  status: 'loading' | 'ready' | 'error'
  error: string
  rotations: number[]
  document?: Raw<PDFDocumentProxy>
}

export function usePdfMerge() {
  const entries = ref<PdfEntry[]>([])
  const importing = ref(false)
  const merging = ref(false)
  const error = ref('')
  const outputUrl = ref('')
  const outputName = ref('merged.pdf')
  const tasks = new Set<PDFDocumentLoadingTask>()
  const mergeController = new AbortController()
  let nextId = 0
  let disposed = false
  const busy = computed(() => importing.value || merging.value)
  const pageCount = computed(() =>
    entries.value.reduce((sum, entry) => sum + entry.rotations.length, 0),
  )
  const canMerge = computed(
    () =>
      entries.value.length > 0 &&
      !busy.value &&
      entries.value.every((entry) => entry.status === 'ready'),
  )
  const downloadName = computed(() => {
    const name =
      Array.from(outputName.value.trim())
        .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
        .join('')
        .replace(/[\\/:*?"<>|]/g, '_') || 'merged.pdf'
    return /\.pdf$/i.test(name) ? name : `${name}.pdf`
  })

  function invalidate() {
    if (outputUrl.value) URL.revokeObjectURL(outputUrl.value)
    outputUrl.value = ''
    error.value = ''
  }

  async function addFiles(files: File[]) {
    if (busy.value || disposed || !files.length) return
    invalidate()
    importing.value = true
    const added = files.map(
      (file): PdfEntry => ({
        id: nextId++,
        file: markRaw(file),
        status: 'loading',
        error: '',
        rotations: [],
      }),
    )
    entries.value.push(...added)
    try {
      for (const original of added) {
        if (disposed) break
        const entry = entries.value.find((item) => item.id === original.id)!
        let task: PDFDocumentLoadingTask | undefined
        try {
          if (!/\.pdf$/i.test(entry.file.name) && entry.file.type !== 'application/pdf')
            throw new Error('请选择 PDF 文件')
          const bytes = new Uint8Array(await entry.file.arrayBuffer())
          if (disposed) break
          const angles = await inspectPdf(bytes)
          if (disposed) break
          entry.rotations = angles.map(() => 0)
          task = loadPdfPreview(bytes)
          tasks.add(task)
          const document = await task.promise
          if (disposed) {
            await task.destroy()
            break
          }
          entry.document = markRaw(document)
          entry.status = 'ready'
        } catch (cause) {
          if (!disposed) {
            entry.status = 'error'
            entry.error = pdfErrorMessage(cause)
          }
          if (task) {
            tasks.delete(task)
            await task.destroy().catch(() => {})
          }
        }
      }
    } finally {
      importing.value = false
    }
  }

  function remove(id: number) {
    if (busy.value) return
    invalidate()
    const entry = entries.value.find((item) => item.id === id)
    if (entry?.document) {
      const task = entry.document.loadingTask
      tasks.delete(task)
      void task.destroy().catch(() => {})
    }
    entries.value = entries.value.filter((item) => item.id !== id)
  }

  function move(id: number, targetIndex: number) {
    if (busy.value || targetIndex < 0 || targetIndex >= entries.value.length) return
    const index = entries.value.findIndex((entry) => entry.id === id)
    if (index < 0 || index === targetIndex) return
    invalidate()
    const [entry] = entries.value.splice(index, 1)
    entries.value.splice(targetIndex, 0, entry!)
  }

  function rotate(id: number, pageIndex?: number) {
    if (busy.value) return
    const entry = entries.value.find((item) => item.id === id)
    if (!entry || entry.status !== 'ready') return
    invalidate()
    entry.rotations = entry.rotations.map((angle, index) =>
      pageIndex === undefined || pageIndex === index ? normalizeRotation(angle + 90) : angle,
    )
  }

  function previewError(id: number, message: string) {
    const entry = entries.value.find((item) => item.id === id)
    if (!entry || entry.status === 'error') return
    invalidate()
    entry.status = 'error'
    entry.error = message
  }

  async function merge() {
    if (!canMerge.value) return
    invalidate()
    merging.value = true
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (disposed || entries.value.some((entry) => entry.status !== 'ready')) return
      const blob = await mergePdfs(
        entries.value.map((entry) => ({ file: entry.file, rotations: [...entry.rotations] })),
        mergeController.signal,
      )
      if (!disposed && entries.value.every((entry) => entry.status === 'ready')) {
        outputUrl.value = URL.createObjectURL(blob)
      }
    } catch (cause) {
      if (!disposed) error.value = pdfErrorMessage(cause)
    } finally {
      merging.value = false
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    mergeController.abort()
    invalidate()
    for (const task of tasks) void task.destroy().catch(() => {})
    tasks.clear()
  })

  return {
    entries,
    busy,
    importing,
    merging,
    error,
    outputUrl,
    outputName,
    downloadName,
    pageCount,
    canMerge,
    addFiles,
    remove,
    move,
    rotate,
    previewError,
    merge,
  }
}
