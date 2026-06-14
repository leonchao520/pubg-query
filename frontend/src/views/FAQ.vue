<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/i18n'

const faqs = [
  { q: 'PUBG.BAR 是什么？', a: 'PUBG.BAR 是一个玩家自建的非官方 PUBG 及 Steam 数据查询工具，基于 PUBG 官方 API 开发，与 KRAFTON 及 Valve 无官方关联。' },
  { q: '数据来源是什么？', a: '本站数据均来自 PUBG 官方开放 API（developer.pubg.com）及 Steam Web API。数据刷新受官方接口限制，赛季数据可能有 10 分钟缓存延迟。' },
  { q: '查询不到我的数据？', a: '请严格区分并准确输入游戏昵称的大小写（PUBG 昵称区分大小写）。如果仍然查不到，可能是以下原因：① 玩家尚未在当前赛季进行竞技模式对局；② 你的平台选错了（默认 Steam）；③ PUBG 官方 API 临时故障。' },
  { q: '为什么有些对局记录不显示？', a: 'PUBG 官方 API 仅提供当前赛季近 14 天的比赛记录。超过 14 天的对局无法获取。' },
  { q: '封禁状态可靠吗？', a: 'Steam 封禁数据来自 Steam 官方 API，但受接口限制有 24 小时内刷新延迟。封禁状态请以游戏内实际提示为准。VAC 封禁和游戏封禁是两种不同类型的处罚。' },
  { q: '排行榜数据更新时间？', a: '排行榜数据由 PUBG 官方自动更新，本站拉取频率受 API 限制（每分钟最多约 10 次请求）。排行榜缓存 10 分钟。' },
  { q: '什么是封禁监控？', a: '封禁监控功能通过定期保存排行榜快照，对比前后两次数据来检测玩家是否从排行榜上消失。掉榜可能意味着被官方封禁。此功能需要手动触发分析。' },
  { q: '收藏玩家有什么用？', a: '收藏你关注的玩家后，可以一键批量刷新他们的最新数据，无需逐个搜索。最多收藏 50 名玩家。' },
  { q: '移动端能用吗？', a: '本站已适配移动端，支持手机浏览器访问。路由和布局在手机端会自动调整。' },
  { q: '如何反馈问题或建议？', a: '请发送邮件至 678226@gmail.com，或通过 GitHub 提 issue。非常欢迎任何反馈！' },
]

const expandedIndex = ref<number | null>(null)

function toggle(i: number) {
  expandedIndex.value = expandedIndex.value === i ? null : i
}
</script>

<template>
  <div class="page-container">
    <div class="title-section">
      <h1 class="page-title">{{ t('nav.faq') }}</h1>
      <p class="page-subtitle">{{ t('app.subtitle') }}</p>
    </div>

    <div class="faq-list">
      <div v-for="(item, i) in faqs" :key="i" class="faq-item glass" @click="toggle(i)">
        <div class="faq-header">
          <span class="faq-q">{{ item.q }}</span>
          <span :class="['faq-arrow', { open: expandedIndex === i }]">▾</span>
        </div>
        <div v-if="expandedIndex === i" class="faq-a">{{ item.a }}</div>
      </div>
    </div>

    <div class="contact-section glass">
      <h3 class="contact-title">📬 {{ t('nav.faq') }}</h3>
      <p>📧 678226@gmail.com</p>
      <p class="contact-hint">{{ t('faq.contact_hint') }}</p>
    </div>

    <div class="disclaimer glass">
      <h3>{{ t('faq.disclaimer') }}</h3>
      <p>{{ t('faq.disclaimer_text') }}</p>
      <p style="margin-top:12px">📧 678226@gmail.com</p>
    </div>
  </div>
</template>

<style scoped>
.page-container { max-width: 700px; margin: 0 auto; padding: 40px 20px 60px; }
.title-section { text-align: center; margin-bottom: 30px; }
.page-title { font-size: 28px; font-weight: 800; color: #fff; }
.page-subtitle { color: #a3a3a3; margin-top: 8px; }
.glass { background: linear-gradient(135deg,#2d2d2d,#1f1f1f); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; }
.faq-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.faq-item { padding: 16px 20px; cursor: pointer; transition: border-color .2s; }
.faq-item:hover { border-color: rgba(123,104,238,.3); }
.faq-header { display: flex; justify-content: space-between; align-items: center; }
.faq-q { color: #e5e5e5; font-size: 15px; font-weight: 500; flex: 1; }
.faq-arrow { color: #888; font-size: 16px; transition: transform .2s; margin-left: 12px; flex-shrink: 0; }
.faq-arrow.open { transform: rotate(180deg); color: #7b68ee; }
.faq-a { margin-top: 12px; color: #a3a3a3; font-size: 14px; line-height: 1.7; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.06); }
.contact-section { padding: 24px; margin-bottom: 20px; text-align: center; }
.contact-title { font-size: 16px; color: #ccc; margin-bottom: 10px; }
.contact-section p { color: #888; font-size: 14px; line-height: 1.6; }
.contact-hint { margin-top: 6px; font-size: 13px; color: #666; }
.disclaimer { padding: 24px; }
.disclaimer h3 { font-size: 16px; color: #888; margin-bottom: 12px; }
.disclaimer p { font-size: 13px; color: #666; line-height: 1.8; }
</style>
