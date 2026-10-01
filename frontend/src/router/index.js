import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import UsersView from '@/views/UsersView.vue'
import MachinesView from '@/views/MachinesView.vue'
import ItemsView from '@/views/ItemsView.vue'
import WorkOrdersView from '@/views/WorkOrdersView.vue'
import OperatorPlaygroundView from '@/views/OperatorPlaygroundView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'work-orders', name: 'work-orders', component: WorkOrdersView },
        {
          path: 'production-analytics',
          name: 'production-analytics',
          component: () => import('@/views/ProductionAnalyticsView.vue'),
          meta: { roles: ['ADMIN', 'SUPERVISOR'] },
        },
        { path: 'operator-playground', name: 'operator-playground', component: OperatorPlaygroundView },
        { path: 'users', name: 'users', component: UsersView },
        { path: 'machines', name: 'machines', component: MachinesView },
        { path: 'items', name: 'items', component: ItemsView },
      ],
    },
    {
      // Papan TV full-screen, di luar DefaultLayout
      path: '/andon-monitoring',
      name: 'andon-monitoring',
      component: () => import('@/views/AndonMonitoringView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.roles && !to.meta.roles.includes(auth.roleCode)) {
    return { name: 'dashboard' }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router