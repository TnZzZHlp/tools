import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RandomStringView from '@/views/RandomStringView.vue'
import RustTracingToLogqlView from '@/views/RustTracingToLogqlView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/random-string',
      name: 'random-string',
      component: RandomStringView,
    },
    {
      path: '/tools/rust-tracing-to-logql',
      name: 'rust-tracing-to-logql',
      component: RustTracingToLogqlView,
    },
  ],
})

export default router
