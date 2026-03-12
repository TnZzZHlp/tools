import { createRouter, createWebHistory } from 'vue-router'
import RustTracingToLogqlView from '@/views/RustTracingToLogqlView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'rust-tracing-to-logql',
      component: RustTracingToLogqlView,
    },
  ],
})

export default router
