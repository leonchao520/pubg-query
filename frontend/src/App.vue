<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ref, watch } from 'vue'
import { toggleLang, getLang, t } from '@/i18n'

const route = useRoute()
const mobileMenuOpen = ref(false)
const lang = ref(getLang())

watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

function toggleMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function handleToggleLang() {
  toggleLang()
  lang.value = getLang()
}
</script>

<template>
  <div class="app">
    <nav class="navbar">
      <div class="nav-inner">
        <RouterLink to="/" class="logo-link">
          <span class="logo-text">PUBG<span class="logo-dot">.</span>BAR</span>
        </RouterLink>

        <!-- 桌面端导航 -->
        <div class="nav-links">
          <RouterLink to="/" class="nav-link">{{ t('nav.query') }}</RouterLink>
          <RouterLink to="/compare" class="nav-link">{{ t('nav.compare') }}</RouterLink>
          <RouterLink to="/leaderboard" class="nav-link">{{ t('nav.leaderboard') }}</RouterLink>
          <RouterLink to="/monitoring" class="nav-link">{{ t('nav.monitoring') }}</RouterLink>
          <RouterLink to="/tracked" class="nav-link">{{ t('nav.tracked') }}</RouterLink>
          <RouterLink to="/faq" class="nav-link">{{ t('nav.faq') }}</RouterLink>
          <button class="lang-btn" @click="handleToggleLang" title="语言/Language">{{ lang === 'zh' ? 'EN' : '中文' }}</button>
        </div>

        <!-- 移动端汉堡按钮 -->
        <button class="hamburger" @click="toggleMenu" :class="{ open: mobileMenuOpen }" aria-label="菜单">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <!-- 移动端下拉菜单 -->
      <div class="mobile-menu" :class="{ open: mobileMenuOpen }">
        <RouterLink to="/" class="mobile-link" @click="mobileMenuOpen = false">🔍 {{ t('nav.query') }}</RouterLink>
        <RouterLink to="/leaderboard" class="mobile-link" @click="mobileMenuOpen = false">🏆 {{ t('nav.leaderboard') }}</RouterLink>
        <RouterLink to="/monitoring" class="mobile-link" @click="mobileMenuOpen = false">🛡️ {{ t('nav.monitoring') }}</RouterLink>
        <RouterLink to="/tracked" class="mobile-link" @click="mobileMenuOpen = false">⭐ {{ t('nav.tracked') }}</RouterLink>
        <RouterLink to="/faq" class="mobile-link" @click="mobileMenuOpen = false">❓ {{ t('nav.faq') }}</RouterLink>
      </div>
    </nav>
    <main class="main-content">
      <RouterView />
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-columns">
          <div class="footer-col">
            <h4 class="footer-brand">PUBG<span class="logo-dot">.</span>BAR</h4>
            <p class="footer-desc">{{ t('footer.desc') }}<br>{{ t('footer.subtitle') }}</p>
          </div>
          <div class="footer-col">
            <h4>{{ t('footer.nav') }}</h4>
            <RouterLink to="/" class="footer-link">{{ t('nav.query') }}</RouterLink>
            <RouterLink to="/leaderboard" class="footer-link">{{ t('nav.leaderboard') }}</RouterLink>
            <RouterLink to="/monitoring" class="footer-link">{{ t('nav.monitoring') }}</RouterLink>
            <RouterLink to="/tracked" class="footer-link">{{ t('nav.tracked') }}</RouterLink>
            <RouterLink to="/faq" class="footer-link">{{ t('nav.faq') }}</RouterLink>
          </div>
          <div class="footer-col">
            <h4>{{ t('footer.statement') }}</h4>
            <p class="footer-text">{{ t('footer.disclaimer') }}<br></p>
            <p class="footer-text">📧 678226@gmail.com</p>
          </div>
        </div>
        <div class="footer-bottom">
          <p>{{ t('footer.copyright') }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  /* 背景色 */
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #2a2a2a;
  --bg-card: #1f1f1f;
  --bg-card-alt: #1e1e22;
  --bg-glass: linear-gradient(135deg, #2d2d2d, #1f1f1f);
  --bg-glass-alt: linear-gradient(135deg, #1e1e22, #16161a);
  --bg-hover: rgba(255,255,255,.05);
  --bg-hover-strong: rgba(255,255,255,.1);
  --bg-accent-subtle: rgba(123,104,238,.08);
  --bg-accent: rgba(123,104,238,.15);
  --bg-accent-strong: rgba(123,104,238,.25);
  
  /* 文字色 */
  --text-primary: #e5e5e5;
  --text-secondary: #a3a3a3;
  --text-muted: #888;
  --text-dim: #666;
  --text-dark: #555;
  --text-darker: #444;
  
  /* 品牌色 */
  --brand: #7b68ee;
  --brand-hover: #9d7bff;
  --brand-light: rgba(123,104,238,.15);
  --brand-border: rgba(123,104,238,.3);
  --brand-glow: rgba(123,104,238,.5);
  
  /* 语义色 */
  --success: #22c55e;
  --success-bg: rgba(34,197,94,.15);
  --success-border: rgba(34,197,94,.3);
  --warning: #fb923c;
  --warning-bg: rgba(251,146,60,.15);
  --warning-border: rgba(251,146,60,.3);
  --error: #ff6b6b;
  --error-bg: rgba(255,107,107,.15);
  --error-border: rgba(255,107,107,.3);
  --gold: #ffc328;
  
  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 50%;
  --radius-pill: 999px;
  
  /* 边框 */
  --border-subtle: 1px solid rgba(255,255,255,.08);
  --border-light: 1px solid rgba(255,255,255,.1);
  --border-accent: 1px solid rgba(123,104,238,.3);
  
  /* 阴影 */
  --shadow-sm: 0 0 6px rgba(0,0,0,.3);
  --shadow-glow-green: 0 0 6px rgba(34,197,94,.3);
  
  /* 过渡 */
  --transition-fast: .15s;
  --transition-normal: .2s;
  --transition-slow: .3s;
  
  /* 字体 */
  --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-heading: 'Space Grotesk', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-display: 'Space Grotesk', sans-serif;
}


body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: var(--border-light);
  border-radius: var(--radius-lg);
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(15, 15, 15, .95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, .1);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-link {
  text-decoration: none;
}

.logo-text {
  font-size: 22px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 1px;
}

.logo-dot {
  color: #7b68ee;
}

.nav-links {
  display: flex;
  gap: 2px;
}

.nav-link {
  padding: 8px 14px;
  color: #a3a3a3;
  text-decoration: none;
  font-size: 14px;
  border-radius: 6px;
  transition: all .2s;
  white-space: nowrap;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, .05);
}

.nav-link.router-link-exact-active {
  color: #7b68ee;
  background: rgba(123, 104, 238, .1);
}

.lang-btn {
  padding: 6px 12px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px;
  color: #a3a3a3;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  margin-left: 8px;
  white-space: nowrap;
}
.lang-btn:hover {
  color: #7b68ee;
  border-color: rgba(123,104,238,.3);
  background: rgba(123,104,238,.08);
}

.main-content {
  padding-top: 56px;
  flex: 1;
}

/* 汉堡按钮 - 默认隐藏 */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  z-index: 101;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: #a3a3a3;
  border-radius: 2px;
  transition: all .3s ease;
}

.hamburger.open span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

/* 移动端下拉菜单 */
.mobile-menu {
  display: none;
  flex-direction: column;
  background: rgba(15, 15, 15, .98);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, .1);
  padding: 8px 0;
  max-height: 0;
  overflow: hidden;
  transition: max-height .3s ease, padding .3s ease;
}

.mobile-menu.open {
  max-height: 300px;
  padding: 8px 0;
}

.mobile-link {
  display: block;
  padding: 14px 24px;
  color: #ccc;
  text-decoration: none;
  font-size: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, .04);
  transition: background .2s;
}

.mobile-link:last-child {
  border-bottom: none;
}

.mobile-link:hover,
.mobile-link.router-link-exact-active {
  background: rgba(123, 104, 238, .08);
  color: #7b68ee;
}

/* Footer */
.site-footer {
  padding: 40px 20px 20px;
  border-top: 1px solid rgba(255,255,255,.08);
  margin-top: auto;
  background: linear-gradient(180deg, #0f0f0f, #0a0a0a);
}

.footer-inner {
  max-width: 1000px;
  margin: 0 auto;
}

.footer-columns {
  display: flex;
  gap: 40px;
  margin-bottom: 30px;
}

.footer-col {
  flex: 1;
  min-width: 140px;
}

.footer-col h4 {
  font-size: 13px;
  font-weight: 600;
  color: #777;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: .5px;
}

.footer-brand {
  font-size: 18px;
  font-weight: 900;
  color: #fff;
  margin-bottom: 8px !important;
  text-transform: none !important;
  letter-spacing: 1px !important;
}

.footer-desc {
  font-size: 12px;
  color: #555;
  line-height: 1.7;
}

.footer-link {
  display: block;
  color: #666;
  text-decoration: none;
  font-size: 13px;
  line-height: 2;
  transition: color .2s;
}

.footer-link:hover {
  color: #7b68ee;
}

.footer-text {
  font-size: 12px;
  color: #555;
  line-height: 1.8;
}

.footer-bottom {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,.05);
}

.footer-bottom p {
  font-size: 11px;
  color: #444;
}

/* 响应式 */
@media (max-width: 768px) {
  .nav-links {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .mobile-menu {
    display: flex;
  }

  .logo-text {
    font-size: 18px;
  }

  .footer-columns {
    flex-direction: column;
    gap: 24px;
  }
}
</style>
