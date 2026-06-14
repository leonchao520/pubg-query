import { createRouter, createWebHistory } from 'vue-router'
import PlayerQuery from '@/views/PlayerQuery.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'player-query', component: PlayerQuery },
    { path: '/leaderboard', name: 'leaderboard', component: () => import('@/views/Leaderboard.vue') },
    { path: '/monitoring', name: 'monitoring', component: () => import('@/views/Monitoring.vue') },
    { path: '/tracked', name: 'tracked', component: () => import('@/views/Tracked.vue') },
    { path: '/match/:matchId', name: 'match-detail', component: () => import('@/views/MatchDetail.vue') },
    { path: '/faq', name: 'faq', component: () => import('@/views/FAQ.vue') },
    { path: '/compare', name: 'compare', component: () => import('@/views/PlayerCompare.vue') },
  ],
})

export default router
