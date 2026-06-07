/* ============================================
   AI 期末私教 — 主控制器
   初始化、事件绑定、模块协调
   ============================================ */

(function () {
  'use strict';

  // ── 缓存 DOM 引用 ──
  const dom = {
    app: document.getElementById('app'),
    header: document.getElementById('header'),
    sidebar: document.getElementById('sidebar'),
    main: document.getElementById('main'),
    chatArea: document.getElementById('chatArea'),
    chatAreaInner: document.getElementById('chatAreaInner'),
    inputArea: document.getElementById('inputArea'),
    inputWrapper: document.getElementById('inputWrapper'),
    inputField: document.getElementById('inputField'),
    sendBtn: document.getElementById('sendBtn'),
    welcomeCard: document.getElementById('welcomeCard'),
    footer: document.getElementById('footer'),

    // 顶栏
    sidebarToggle: document.getElementById('sidebarToggle'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),
    historyToggle: document.getElementById('historyToggle'),

    // 侧栏
    chapterList: document.getElementById('chapterList'),
    quickActions: document.getElementById('quickActions'),

    // 步骤
    stepIndicator: document.getElementById('stepIndicator'),

    // 历史抽屉
    historyDrawer: document.getElementById('historyDrawer'),
    historyClose: document.getElementById('historyClose'),
    historyList: document.getElementById('historyList'),
    overlay: document.getElementById('overlay'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),
  };

  /**
   * 应用初始化入口
   */
  function init() {
    console.log('[App] AI 期末私教 正在初始化...');

    // 1. 将 DOM 引用分发给各模块
    UI.bindDom(dom);
    Chat.bindDom(dom);

    // 2. 初始化渲染器（配置 marked.js）
    Renderer.init();

    // 3. 恢复用户偏好设置
    UI.initTheme();
    UI.initSidebar();

    // 恢复步骤状态
    const savedStep = localStorage.getItem(AppConfig.storageKeys.currentStep);
    if (savedStep) UI.setStep(parseInt(savedStep));

    // 4. 渲染章节导航
    UI.renderChapterList(AppConfig.defaults.defaultChapter);

    // 5. 绑定所有交互事件
    bindEvents();

    // 6. 监听自定义事件
    bindCustomEvents();

    console.log('[App] 初始化完成 ✓');
  }

  /* ════════════════════
     事件绑定
     ════════════════════ */

  function bindEvents() {
    // ── 输入框 ──
    if (dom.inputField) {
      // 发送按钮
      if (dom.sendBtn) {
        dom.sendBtn.addEventListener('click', handleSend);
      }

      // Enter 发送 / Shift+Enter 换行
      dom.inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });

      // 自动高度 + 发送按钮状态
      dom.inputField.addEventListener('input', () => {
        Chat.adjustInputHeight();
        Chat.updateSendBtnState();
      });
    }

    // ── 顶栏按钮 ──
    if (dom.sidebarToggle) {
      dom.sidebarToggle.addEventListener('click', () => UI.toggleSidebar());
    }
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', () => UI.toggleTheme());
    }
    if (dom.historyToggle) {
      dom.historyToggle.addEventListener('click', () => UI.openHistoryDrawer());
    }

    // ── 历史抽屉 ──
    if (dom.historyClose) {
      dom.historyClose.addEventListener('click', () => UI.closeHistoryDrawer());
    }
    if (dom.overlay) {
      dom.overlay.addEventListener('click', () => UI.closeHistoryDrawer());
    }

    // ── 快捷操作按钮（侧栏）──
    if (dom.quickActions) {
      dom.quickActions.querySelectorAll('.quick-action-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const stepMap = { 'ask-knowledge': 1, 'practice': 2, 'analysis': 3, 'extend': 4 };
          if (stepMap[action]) UI.setStep(stepMap[action]);
          Chat.sendAction(action);
        });
      });
    }

    // ── 欢迎卡片快捷按钮 ──
    if (dom.welcomeCard) {
      dom.welcomeCard.querySelectorAll('.welcome-action-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.welcome;
          const prompt = AppConfig.defaults.welcomePrompts[key];
          if (prompt) {
            Chat.sendMessage(prompt);
          }
        });
      });
    }

    // ── 步骤指示器点击 ──
    if (dom.stepIndicator) {
      dom.stepIndicator.querySelectorAll('.step-item').forEach((el) => {
        el.addEventListener('click', () => {
          const step = parseInt(el.dataset.step);
          UI.setStep(step);
          // 点击步骤时自动触发对应操作
          const actions = { 1: 'ask-knowledge', 2: 'practice', 3: 'analysis', 4: 'extend' };
          Chat.sendAction(actions[step]);
        });
      });
    }

    // ── ESC 关闭抽屉/弹窗 ──
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UI.closeHistoryDrawer();
      }
    });

    // ── 窗口大小变化时调整（移动端自动收起侧栏）──
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // 移动端下如果侧栏是展开的，可以做一些适配
      }, 200);
    });

    // ── 聊天区滚动到底部按钮（可选：双击聊天区快速回底）──
    if (dom.chatArea) {
      dom.chatArea.addEventListener('dblclick', (e) => {
        if (e.target === dom.chatArea || e.target === dom.chatAreaInner) {
          UI.scrollToBottom();
        }
      });
    }
  }

  /* ════════════════════
     自定义事件监听
     ════════════════════ */

  function bindCustomEvents() {
    // 恢复历史会话
    window.addEventListener('tutor:restore-session', async (e) => {
      const { id } = e.detail || {};
      const session = History.get(id);
      if (session) {
        Chat.restoreSession(session);
        UI.showToast('会话已恢复', 'success');
      } else {
        UI.showToast('该会话记录不存在', 'error');
      }
    });

    // 选择章节
    window.addEventListener('tutor:select-chapter', (e) => {
      const { name } = e.detail || {};
      if (name) {
        UI.showToast(`已切换到「${name}」`, 'info', 1500);
      }
    });
  }

  /* ════════════════════
     处理发送消息
     ════════════════════ */

  function handleSend() {
    if (!dom.inputField) return;
    const text = dom.inputField.value.trim();
    if (!text) return;

    Chat.sendMessage(text);
  }

  /* ════════════════════
     启动应用
     ════════════════════ */

  // DOM 就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
