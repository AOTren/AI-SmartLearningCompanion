/* ============================================
   AI 期末私教 — UI 交互控制
   主题切换、侧栏、步骤指示器、Toast 等
   ============================================ */

const UI = (() => {
  // ── 状态 ──
  let currentTheme = null;
  let sidebarCollapsed = false;

  // ── DOM 引用（延迟绑定，在 app.js init 时设置）──
  let dom = {};

  /**
   * 绑定 DOM 元素引用
   */
  function bindDom(refs) {
    dom = refs;
  }

  /* ════════════════════
     主题管理
     ════════════════════ */

  function initTheme() {
    const saved = localStorage.getItem(AppConfig.storageKeys.theme);
    if (saved) {
      currentTheme = saved;
    } else {
      // 跟随系统
      currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(currentTheme);

    // 监听系统主题变化（仅当用户未手动设置时）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(AppConfig.storageKeys.theme)) {
        currentTheme = e.matches ? 'dark' : 'light';
        applyTheme(currentTheme);
      }
    });
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(AppConfig.storageKeys.theme, currentTheme);
    applyTheme(currentTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    if (dom.themeIcon) {
      dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (dom.themeText) {
      dom.themeText.textContent = theme === 'dark' ? '亮色' : '暗色';
    }
  }

  /* ════════════════════
     侧栏控制
     ════════════════════ */

  function initSidebar() {
    const saved = localStorage.getItem(AppConfig.storageKeys.sidebarCollapsed);
    sidebarCollapsed = saved === 'true';

    if (sidebarCollapsed && dom.sidebar) {
      dom.sidebar.classList.add('sidebar--collapsed');
    }
  }

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem(AppConfig.storageKeys.sidebarCollapsed, String(sidebarCollapsed));

    if (dom.sidebar) {
      dom.sidebar.classList.toggle('sidebar--collapsed', sidebarCollapsed);
    }
  }

  function openSidebar() {
    sidebarCollapsed = false;
    localStorage.setItem(AppConfig.storageKeys.sidebarCollapsed, 'false');
    if (dom.sidebar) {
      dom.sidebar.classList.remove('sidebar--collapsed');
    }
  }

  /* ════════════════════
     步骤指示器
     ════════════════════ */

  let currentStep = 1;

  function setStep(stepNum) {
    currentStep = Math.max(1, Math.min(4, stepNum));
    localStorage.setItem(AppConfig.storageKeys.currentStep, String(currentStep));

    if (dom.stepIndicator) {
      dom.stepIndicator.querySelectorAll('.step-item').forEach((el) => {
        const step = parseInt(el.dataset.step);
        el.classList.remove('step-item--active', 'step-item--done');

        if (step < currentStep) {
          el.classList.add('step-item--done');
        } else if (step === currentStep) {
          el.classList.add('step-item--active');
        }
      });

      // 更新分隔线状态
      dom.stepIndicator.querySelectorAll('.step-divider').forEach((el, i) => {
        el.classList.toggle('step-divider--active', i < currentStep - 1);
      });
    }
  }

  function getStep() {
    return currentStep;
  }

  /* ════════════════════
     历史记录抽屉
     ════════════════════ */

  function openHistoryDrawer() {
    if (dom.historyDrawer) dom.historyDrawer.classList.add('history-drawer--open');
    if (dom.overlay) dom.overlay.classList.add('overlay--visible');
    // 渲染列表
    History.renderList(dom.historyList);

    // 绑定点击事件
    if (dom.historyList) {
      dom.historyList.querySelectorAll('.history-item').forEach((item) => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          // 触发恢复会话（通过自定义事件）
          window.dispatchEvent(new CustomEvent('tutor:restore-session', { detail: { id } }));
          closeHistoryDrawer();
        });
      });
    }
  }

  function closeHistoryDrawer() {
    if (dom.historyDrawer) dom.historyDrawer.classList.remove('history-drawer--open');
    if (dom.overlay) dom.overlay.classList.remove('overlay--visible');
  }

  /* ════════════════════
     Toast 提示
     ════════════════════ */

  /**
   * 显示提示消息
   * @param {string} message - 提示文本
   * @param {'success'|'error'|'info'} type - 类型
   * @param {number} duration - 显示时长(ms)
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = dom.toastContainer || document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type]}</span>
      <span class="toast__msg">${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ════════════════════
     欢迎卡片控制
     ════════════════════ */

  function hideWelcome() {
    if (dom.welcomeCard) {
      dom.welcomeCard.style.display = 'none';
    }
  }

  function showWelcome() {
    if (dom.welcomeCard) {
      dom.welcomeCard.style.display = '';
    }
  }

  /* ════════════════════
     章节导航渲染
     ════════════════════ */

  function renderChapterList(activeId) {
    const chapters = AppConfig.course.chapters;
    if (!dom.chapterList) return;

    dom.chapterList.innerHTML = chapters.map((ch) => `
      <div class="chapter-item ${ch.id === activeId ? 'chapter-item--active' : ''}"
           data-chapter-id="${ch.id}" data-chapter-name="${ch.name}">
        <span class="chapter-item__num">${ch.num}</span>
        <span class="chapter-item__name">${ch.name}</span>
        <span class="chapter-item__dot"></span>
      </div>`).join('');

    // 绑定点击
    dom.chapterList.querySelectorAll('.chapter-item').forEach((el) => {
      el.addEventListener('click', () => {
        setActiveChapter(el.dataset.chapterId);
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('tutor:select-chapter', {
          detail: { id: el.dataset.chapterId, name: el.dataset.chapterName },
        }));
      });
    });
  }

  let activeChapterId = AppConfig.defaults.defaultChapter;

  function setActiveChapter(id) {
    activeChapterId = id;
    if (dom.chapterList) {
      dom.chapterList.querySelectorAll('.chapter-item').forEach((el) => {
        el.classList.toggle('chapter-item--active', el.dataset.chapterId === id);
      });
    }
  }

  function getActiveChapter() {
    const ch = AppConfig.course.chapters.find((c) => c.id === activeChapterId);
    return ch || AppConfig.course.chapters[0];
  }

  /* ════════════════════
     工具函数
     ════════════════════ */

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  /**
   * 自动滚动聊天区到底部
   */
  function scrollToBottom() {
    if (dom.chatArea) {
      requestAnimationFrame(() => {
        dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
      });
    }
  }

  return {
    bindDom,
    initTheme,
    toggleTheme,
    initSidebar,
    toggleSidebar,
    openSidebar,
    setStep,
    getStep,
    openHistoryDrawer,
    closeHistoryDrawer,
    showToast,
    hideWelcome,
    showWelcome,
    renderChapterList,
    setActiveChapter,
    getActiveChapter,
    scrollToBottom,
  };
})();
