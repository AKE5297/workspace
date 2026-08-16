import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', redirect: '/clips' },
      { path: 'clips', name: 'clips', component: () => import('@/views/Clips.vue'), meta: { title: '剪藏列表' } },
      { path: 'notebooks', name: 'notebooks', component: () => import('@/views/Notebooks.vue'), meta: { title: '笔记本' } },
      { path: 'tags', name: 'tags', component: () => import('@/views/Tags.vue'), meta: { title: '标签' } },
      { path: 'favorites', name: 'favorites', component: () => import('@/views/Favorites.vue'), meta: { title: '收藏' } },
      { path: 'drafts', name: 'drafts', component: () => import('@/views/Drafts.vue'), meta: { title: '草稿箱' } },
      { path: 'stats', name: 'stats', component: () => import('@/views/Stats.vue'), meta: { title: '统计' } },
      { path: 'recycle', name: 'recycle', component: () => import('@/views/Recycle.vue'), meta: { title: '回收站' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置' } },
      { path: 'shares', name: 'shares', component: () => import('@/views/Shares.vue'), meta: { title: '分享管理' } }
    ]
  },
  {
    path: '/clip/:id',
    name: 'clip-detail',
    component: () => import('@/views/ClipDetail.vue'),
    meta: { auth: true, title: '剪藏详情' }
  },
  {
    path: '/share/:code',
    name: 'public-share',
    component: () => import('@/views/PublicShare.vue'),
    meta: { public: true, title: '分享的剪藏' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('wc_token');
  if (to.meta.public) {
    if (to.name === 'login' && token) return next('/');
    return next();
  }
  if (!token) return next('/login');
  document.title = to.meta.title ? `${to.meta.title} - Web Clipper` : 'Web Clipper';
  next();
});

export default router;
