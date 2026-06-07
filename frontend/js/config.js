/* ============================================
   AI 期末私教 — 配置文件
   API 地址、章节列表、默认设置
   ============================================ */

window.AppConfig = {
  // ── 后端 API 地址 ──
  // 本地开发用 'http://localhost:8000'，云端部署用 '' (同源相对路径)
  apiBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '',  // 云端部署时前后端同源，用相对路径

  // ── API 端点 ──
  endpoints: {
    chat: '/api/chat',
  },

  // ── 课程配置（可按实际修改）──
  course: {
    name: '数据库系统原理',
    chapters: [
      { id: 'ch1', num: '1', name: '绪论' },
      { id: 'ch2', num: '2', name: '关系数据库' },
      { id: 'ch3', num: '3', name: '关系数据库标准语言 SQL' },
      { id: 'ch4', num: '4', name: '数据库安全性' },
      { id: 'ch5', num: '5', name: '数据库完整性' },
      { id: 'ch6', num: '6', name: '关系数据理论（范式）' },
      { id: 'ch7', num: '7', name: '数据库设计' },
      { id: 'ch8', num: '8', name: '数据库编程' },
      { id: 'ch9', num: '9', name: '关系查询处理与优化' },
      { id: 'ch10', num: '10', name: '数据库恢复技术' },
      { id: 'ch11', num: '11', name: '并发控制' },
    ],
  },

  // ── 默认设置 ──
  defaults: {
    theme: null, // null = 跟随系统，'light' / 'dark'
    defaultChapter: 'ch3', // 默认聚焦章节

    // 步骤名称映射
    stepNames: {
      1: '考点提问',
      2: '真题演练',
      3: '错因分析',
      4: '举一反三',
    },

    // 快捷操作提示语
    actionPrompts: {
      'ask-knowledge': '请帮我梳理第{chapter}章的考点和重点内容',
      practice: '请给我出一道第{chapter}章的真题来练习',
      analysis: '我刚才答错了，请帮我分析错因并讲解正确思路',
      extend: '请基于当前考点再出几道类似的练习题（举一反三）',
    },

    // 欢迎卡片按钮对应的消息
    welcomePrompts: {
      review: '请帮我梳理第三章 关系数据库标准语言SQL 的考点和重点内容',
      quiz: '请给我出一道关于数据库的真题来做做看',
      help: '你能帮我做什么？介绍一下你的功能和使用方式吧',
    },
  },

  // ── SSE 配置 ──
  sse: {
    reconnectDelay: 3000,
    maxRetries: 3,
  },

  // ── 存储键名 ──
  storageKeys: {
    theme: 'ai-tutor-theme',
    history: 'ai-tutor-history',
    currentStep: 'ai-tutor-step',
    sidebarCollapsed: 'ai-tutor-sidebar',
  },
};
