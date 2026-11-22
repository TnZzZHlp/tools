import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tools/speedtest',
      name: 'speedtest',
      component: () => import('@/views/SpeedtestView.vue'),
    },
    {
      path: '/tools/ip-check',
      name: 'ip-check',
      component: () => import('@/views/IpCheckView.vue'),
    },
    {
      path: '/random-string',
      name: 'random-string',
      component: () => import('@/views/RandomStringView.vue'),
    },
    {
      path: '/tools/rust-tracing-to-logql',
      name: 'rust-tracing-to-logql',
      component: () => import('@/views/RustTracingToLogqlView.vue'),
    },
    {
      path: '/tools/encoding',
      name: 'encoding',
      component: () => import('@/views/EncodingView.vue'),
    },
    {
      path: '/tools/guitar-note-trainer',
      name: 'guitar-note-trainer',
      component: () => import('@/views/GuitarNoteTrainerView.vue'),
    },
    {
      path: '/tools/files',
      name: 'file-tools',
      component: () => import('@/views/FileToolsView.vue'),
    },
    {
      path: '/tools/files/pdf-merge',
      name: 'pdf-merge',
      component: () => import('@/views/PdfMergeView.vue'),
    },
    {
      path: '/company',
      name: 'company-tools',
      component: () => import('@/views/CompanyToolsView.vue'),
    },
    {
      path: '/tools/exam-paper',
      name: 'exam-paper-generator',
      meta: { fullscreen: true },
      component: () => import('@/views/ExamPaperView.vue'),
    },
    {
      path: '/tools/answer-sheet',
      name: 'answer-sheet',
      meta: { fullscreen: true },
      component: () => import('@/views/AnswerSheetView.vue'),
    },
    {
      path: '/tools/barcode-generator',
      name: 'barcode-generator',
      component: () => import('@/views/BarcodeGeneratorView.vue'),
    },
    {
      path: '/tools/barcode-reader',
      name: 'barcode-reader',
      component: () => import('@/views/BarcodeReaderView.vue'),
    },
    {
      path: '/tools/mac-address-scanner',
      name: 'mac-address-scanner',
      component: () => import('@/views/MacAddressScannerView.vue'),
    },
    {
      path: '/randomyuri',
      name: 'random-yuri',
      component: () => import('@/views/RandomYuriView.vue'),
    },
    {
      path: '/novels',
      name: 'novels',
      component: () => import('@/views/NovelsView.vue'),
    },
    {
      path: '/novels/:novelId',
      name: 'novel-detail',
      props: true,
      component: () => import('@/views/NovelDetailView.vue'),
    },
    {
      path: '/novels/:novelId/chapters/:chapterId',
      name: 'novel-reader',
      meta: { fullscreen: true },
      component: () => import('@/views/NovelReaderView.vue'),
    },
  ],
})

export default router
