/* ============================================
   AI 期末私教 — 内容渲染器
   Markdown → HTML、KaTeX 公式、代码高亮
   ============================================ */

const Renderer = (() => {
  // ── marked.js 配置 ──
  function initMarked() {
    if (typeof marked === 'undefined') {
      console.warn('[Renderer] marked.js 未加载');
      return;
    }

    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });

    // 自定义 renderer：为代码块添加语言标记
    const renderer = new marked.Renderer();
    renderer.code = function (code, language) {
      const lang = language || '';
      const highlighted = highlightCode(code, lang);
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
    };
    marked.use({ renderer });
  }

  /**
   * 将 Markdown 文本渲染为安全的 HTML
   */
  function renderMarkdown(text) {
    if (!text) return '';

    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(text);
      } catch (e) {
        console.warn('[Renderer] Markdown 解析失败:', e);
        return escapeHtml(text);
      }
    }
    // fallback：纯文本 + 基本换行
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  /**
   * 渲染数学公式（KaTeX）
   * 需要在 DOM 元素插入后调用
   */
  function renderMath(element) {
    if (typeof renderMathInElement === 'undefined') return;

    try {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    } catch (e) {
      console.warn('[Renderer] KaTeX 渲染失败:', e);
    }
  }

  /**
   * 代码高亮
   */
  function highlightCode(code, language) {
    if (typeof hljs === 'undefined') return escapeHtml(code);

    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language }).value;
      } catch (e) {
        // ignore
      }
    }
    return hljs.highlightAuto(code).value;
  }

  /**
   * 渲染完整的 AI 消息内容
   * @param {string} markdownText - Markdown 格式的文本
   * @param {HTMLElement} container - 要插入内容的容器元素
   */
  function renderMessage(markdownText, container) {
    const html = renderMarkdown(markdownText);
    container.innerHTML = html;

    // 渲染数学公式
    renderMath(container);

    // 对代码块执行高亮（marked 自定义 renderer 已处理，这里做兜底）
    if (typeof hljs !== 'undefined') {
      container.querySelectorAll('pre code:not(.hljs-processed)').forEach((block) => {
        hljs.highlightElement(block);
        block.classList.add('hljs-processed');
      });
    }
  }

  /**
   * 追加增量文本到消息容器
   * 用于流式输出场景
   * @param {string} text - 新增的文本片段
   * @param {HTMLElement} container - 目标容器
   */
  function appendStreaming(text, container) {
    // 累积文本并重新渲染（流式场景下性能可接受）
    const currentRaw = container.dataset.rawContent || '';
    const updated = currentRaw + text;
    container.dataset.rawContent = updated;
    renderMessage(updated, container);
  }

  /**
   * 最终化流式消息（清除临时数据）
   */
  function finalizeMessage(container) {
    delete container.dataset.rawContent;
  }

  /**
   * 创建引用来源卡片 HTML
   */
  function createCitationCard(citations) {
    if (!citations || citations.length === 0) return '';

    const items = citations.map((c) => {
      const confidenceClass =
        c.score >= 90 ? 'high' : c.score >= 75 ? 'medium' : 'low';
      const confidenceLabel = c.score >= 90 ? '高匹配' : c.score >= 75 ? '中匹配' : '低';

      return `
        <div class="citation-item">
          <span class="citation-item__file-icon">📄</span>
          <div class="citation-item__info">
            <div class="citation-item__filename">${escapeHtml(c.filename || '未知文件')}</div>
            <div class="citation-item__detail">${escapeHtml(c.location || '')}</div>
          </div>
          <span class="citation-item__confidence citation-item__confidence--${confidenceClass}">
            ${c.score}% · ${confidenceLabel}
          </span>
        </div>`;
    }).join('');

    return `
      <div class="citation-card">
        <div class="citation-card__header" onclick="this.parentElement.querySelector('.citation-card__list').style.display=this.parentElement.querySelector('.citation-card__list').style.display==='none'?'block':'none'">
          <span class="citation-card__icon">🔖</span>
          引用来源 (${citations.length})
        </div>
        <div class="citation-card__list">${items}</div>
      </div>`;
  }

  /**
   * 创建练习题卡片 HTML
   */
  function createPracticeCard(data) {
    if (!data || !data.question) return '';

    const options = (data.options || []).map((opt, i) => {
      const labels = ['A', 'B', 'C', 'D'];
      return `
        <div class="practice-option" data-index="${i}" data-label="${labels[i]}" onclick="window.Chat?.handleOptionClick(this, ${data._msgId})">
          <span class="practice-option__label">${labels[i]}</span>
          <span class="practice-option__text">${escapeHtml(opt)}</span>
          <span class="practice-option__result-icon"></span>
        </div>`;
    }).join('');

    return `
      <div class="practice-card">
        <div class="practice-card__header">
          <span class="practice-card__header-icon">📝</span>
          <span class="practice-card__header-title">真题演练</span>
        </div>
        <div class="practice-card__body">
          <div class="practice-question">${escapeHtml(data.question)}</div>
          <div class="practice-options" id="options-${data._msgId}">${options}</div>
          <div id="explanation-${data._msgId}" class="practice-explanation" style="display:none;"></div>
        </div>
      </div>`;
  }

  /**
   * 显示练习结果
   */
  function showPracticeResult(container, isCorrect, correctAnswer, explanation, userIndex, correctIndex) {
    const optionsContainer = container.querySelectorAll('.practice-option');

    optionsContainer.forEach((opt, i) => {
      opt.classList.add('practice-option--disabled');

      if (i === userIndex) {
        opt.classList.add(isCorrect ? 'practice-option--correct' : 'practice-option--wrong');
        opt.querySelector('.practice-option__result-icon').textContent = isCorrect ? '✅' : '❌';
      } else if (i === correctIndex && !isCorrect) {
        opt.classList.add('practice-option--correct');
        opt.classList.remove('practice-option--disabled');
        opt.classList.add('practice-option--show-correct');
      } else if (!isCorrect) {
        opt.classList.add('practice-option--show-correct');
      }
    });

    // 显示解析区
    const explanationEl = container.querySelector(`#explanation-${container.id.replace('options-', '')}`);
    if (explanationEl) {
      explanationEl.style.display = '';
      explanationEl.className = `practice-explanation practice-explanation--${isCorrect ? 'success' : 'error'}`;
      explanationEl.innerHTML = `
        <div class="practice-explanation__title practice-explanation__title--${isCorrect ? 'success' : 'error'}">
          ${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
        </div>
        <div class="practice-explanation__text">${explanation}</div>`;
    }
  }

  /**
   * 创建快捷操作按钮栏
   */
  function createQuickReplies(actions) {
    if (!actions || actions.length === 0) return '';

    const buttons = actions.map((a) => `
      <button class="quick-reply-btn" data-action="${a.action}" data-prompt="${encodeURIComponent(a.prompt || '')}">
        <span class="quick-reply-btn__icon">${a.icon || '💬'}</span>
        ${escapeHtml(a.label)}
      </button>`).join('');

    return `<div class="quick-reply-bar">${buttons}</div>`;
  }

  // ── 工具函数 ──

  /** HTML 转义 */
  function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (c) => map[c]);
  }

  return {
    init: initMarked,
    render: renderMessage,
    appendStreaming,
    finalizeMessage,
    createCitationCard,
    createPracticeCard,
    showPracticeResult,
    createQuickReplies,
    renderMath,
    escapeHtml,
  };
})();
