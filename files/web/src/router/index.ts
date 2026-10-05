import { createRouter, createWebHistory } from 'vue-router';
import { appName } from '@/config.ts';
import HomePage from '@/pages/HomePage.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** Page title, shown as "<title> · <app name>". */
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('@/pages/NotesPage.vue'),
      meta: { title: 'Notes' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { title: 'Not found' },
    },
  ],
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${appName}` : appName;
});
