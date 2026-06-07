/* ============================================
   AI 期末私教 — 历史记录管理
   localStorage 持久化 + 会话管理
   ============================================ */

const History = (() => {
  const STORAGE_KEY = AppConfig.storageKeys.history;
  const MAX_HISTORY = 50; // 最大保存条数

  /**
   * 获取所有历史记录
   * @returns {Array}
   */
  function getAll() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[History] 读取失败:', e);
      return [];
    }
  }

  /**
   * 保存一条历史会话
   * @param {object} session - { id, messages, createdAt, chapter, summary }
   */
  function save(session) {
    const list = getAll();

    // 如果已存在相同 ID 则更新，否则新增
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session };
    } else {
      list.unshift(session);
    }

    // 限制数量
    if (list.length > MAX_HISTORY) {
      list.splice(MAX_HISTORY);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[History] 存储空间可能不足:', e);
    }
  }

  /**
   * 获取单条历史
   */
  function get(id) {
    return getAll().find((s) => s.id === id) || null;
  }

  /**
   * 删除单条历史
   */
  function remove(id) {
    const list = getAll().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  /**
   * 清空所有历史
   */
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * 导出当前会话为 Markdown 文件
   * @param {Array} messages - 消息数组 [{ role: 'user'|'ai', content: string, timestamp }]
   * @param {string} [filename] - 文件名
   */
  function exportMarkdown(messages, filename) {
    if (!messages || messages.length === 0) return;

    let md = `# AI 期末私教 — 对话记录\n\n`;
    md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;

    messages.forEach((msg) => {
      const roleLabel = msg.role === 'user' ? '👤 我' : '🎓 AI 私教';
      const time = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString('zh-CN')
        : '';
      md += `## ${roleLabel}${time ? ` (${time})` : ''}\n\n${msg.content}\n\n---\n\n`;
    });

    // 触发下载
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `AI私教对话_${formatDate(new Date())}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 生成会话摘要（取首条用户消息前30字）
   */
  function generateSummary(messages) {
    if (!messages || messages.length === 0) return '新对话';
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (!firstUserMsg) return '新对话';
    const text = firstUserMsg.content.replace(/[#*\[\]]/g, '').trim();
    return text.length > 40 ? text.slice(0, 40) + '...' : text;
  }

  /**
   * 渲染历史列表 UI
   */
  function renderList(containerEl) {
    const list = getAll();

    if (!containerEl) return;

    if (list.length === 0) {
      containerEl.innerHTML = `
        <div class="history-empty">
          <div class="history-empty__icon">📋</div>
          <div>暂无对话记录</div>
          <div style="font-size:12px;color:var(--color-text-muted);">开始聊天后这里会显示你的学习记录</div>
        </div>`;
      return;
    }

    containerEl.innerHTML = list.map((item) => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item__header">
          <span class="history-item__time">${formatTime(item.createdAt)}</span>
          ${item.chapter ? `<span class="history-item__chapter-tag">${escapeHtml(item.chapter)}</span>` : ''}
        </div>
        <div class="history-item__preview">${escapeHtml(item.summary || '')}</div>
      </div>`).join('');
  }

  // ── 工具函数 ──

  function formatDate(d) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
           ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  return {
    getAll,
    save,
    get,
    remove,
    clearAll,
    exportMarkdown,
    generateSummary,
    renderList,
  };
})();
