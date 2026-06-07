/* ============================================
   AI 期末私教 — 聊天引擎
   消息管理、气泡渲染、流式输出
   ============================================ */

const Chat = (() => {
  // ── 状态 ──
  let conversationId = null;
  let isStreaming = false; // 是否正在等待 AI 回复
  let currentAiMsgEl = null; // 当前正在流式输出的 AI 消息元素
  let messageCount = 0;

  // ── DOM 引用（由 app.js 设置）──
  let dom = {};

  function bindDom(refs) {
    dom = refs;
  }

  /* ════════════════════
     发送消息
     ════════════════════ */

  /**
   * 发送用户消息并触发 AI 回复
   * @param {string} text - 用户输入文本
   */
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 防止重复发送
    if (isStreaming) return;

    // 隐藏欢迎卡片
    UI.hideWelcome();

    // 清空输入框
    if (dom.inputField) {
      dom.inputField.value = '';
      adjustInputHeight();
      updateSendBtnState();
    }

    // 渲染用户消息气泡
    appendUserBubble(trimmed);

    // 显示 AI 思考动画
    showTypingIndicator();

    // 开始流式请求
    isStreaming = true;
    updateSendBtnState();

    try {
      await Api.chatStream(trimmed, conversationId, {
        // 收到文本片段
        message(content) {
          hideTypingIndicator();

          if (!currentAiMsgEl) {
            currentAiMsgEl = createAiBubble();
          }

          Renderer.appendStreaming(content, currentAiMsgEl.querySelector('.message__content'));
          UI.scrollToBottom();
        },

        // 收到引用来源
        citation(data) {
          if (currentAiMsgEl) {
            const content = currentAiMsgEl.querySelector('.message__content');
            const existingCard = content.querySelector('.citation-card');
            const cardHtml = Renderer.createCitationCard(data.citations || [data]);

            if (existingCard) {
              existingCard.outerHTML = cardHtml;
            } else {
              content.insertAdjacentHTML('beforeend', cardHtml);
            }
            UI.scrollToBottom();
          }
        },

        // 收到练习题
        practice(data) {
          if (currentAiMsgEl) {
            data._msgId = 'practice_' + Date.now();
            const content = currentAiMsgEl.querySelector('.message__content');
            content.insertAdjacentHTML('beforeend', Renderer.createPracticeCard(data));
            UI.scrollToBottom();
          }
        },

        // 流结束
        done(newConversationId) {
          if (newConversationId) {
            conversationId = newConversationId;
          }

          finalizeAiMessage();
          appendQuickReplies();
          saveCurrentSession();
          isStreaming = false;
          updateSendBtnState();
          UI.scrollToBottom();
        },

        // 出错
        error(msg) {
          hideTypingIndicator();

          if (currentAiMsgEl) {
            const content = currentAiMsgEl.querySelector('.message__content');
            content.innerHTML += `<p style="color:var(--color-error);margin-top:8px;">⚠️ ${Renderer.escapeHtml(msg || '出错了，请稍后重试')}</p>`;
          } else {
            createAiBubble(`⚠️ ${msg || '连接失败，请确认后端服务已启动'}`);
          }

          finalizeAiMessage();
          isStreaming = false;
          updateSendBtnState();
        },
      });
    } catch (err) {
      console.error('[Chat] 异常:', err);
      hideTypingIndicator();
      isStreaming = false;
      updateSendBtnState();
    }
  }

  /**
   * 通过快捷操作发送预设消息
   */
  function sendAction(actionKey) {
    const chapter = UI.getActiveChapter();
    const promptTemplate = AppConfig.defaults.actionPrompts[actionKey];
    if (!promptTemplate) return;

    const prompt = promptTemplate.replace('{chapter}', chapter.num + ' ' + chapter.name);
    sendMessage(prompt);
  }

  /* ════════════════════
     消息气泡创建
     ════════════════════ */

  function appendUserBubble(text) {
    const html = createUserBubbleHtml(text);
    insertMessage(html);
    UI.scrollToBottom();
  }

  function createAiBubble(initialText) {
    const html = createAiBubbleHtml(initialText || '');
    insertMessage(html);
    currentAiMsgEl = dom.chatAreaInner.lastElementChild;
    return currentAiMsgEl;
  }

  function insertMessage(html) {
    if (!dom.chatAreaInner) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    dom.chatAreaInner.appendChild(wrapper.firstElementChild);
    messageCount++;
  }

  function createUserBubbleHtml(text) {
    const avatar = '我';
    return `
      <div class="message message--user" id="msg_${Date.now()}">
        <div class="message__avatar">${avatar}</div>
        <div class="message__body">
          <div class="message__bubble">
            <div class="message__content">${Renderer.escapeHtml(text)}</div>
          </div>
          <div class="message__time">${getCurrentTime()}</div>
        </div>
      </div>`;
  }

  function createAiBubbleHtml(text) {
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    // 初始文本用 escapeHtml 简单转义，不要调用 Renderer.render（它需要 container 参数）
    const safeText = text ? Renderer.escapeHtml(text) : '';
    return `
      <div class="message message--ai" id="${id}">
        <div class="message__avatar">🤖</div>
        <div class="message__body">
          <div class="message__bubble">
            <div class="message__content" data-raw-content="">${safeText}</div>
          </div>
          <div class="message__time">${getCurrentTime()}</div>
        </div>
      </div>`;
  }

  /* ════════════════════
     思考中动画
     ════════════════════ */

  let typingEl = null;

  function showTypingIndicator() {
    if (typingEl) return;

    typingEl = document.createElement('div');
    typingEl.className = 'message message--ai';
    typingEl.id = '__typing';
    typingEl.innerHTML = `
      <div class="message__avatar">🤖</div>
      <div class="message__body">
        <div class="message__bubble">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>`;

    if (dom.chatAreaInner) {
      dom.chatAreaInner.appendChild(typingEl);
      UI.scrollToBottom();
    }
  }

  function hideTypingIndicator() {
    if (typingEl && typingEl.parentNode) {
      typingEl.remove();
      typingEl = null;
    }
  }

  /* ════════════════════
     快捷回复按钮（AI 回复后显示）
     ════════════════════ */

  function appendQuickReplies() {
    if (!currentAiMsgEl) return;

    const step = UI.getStep();
    let actions = [];

    switch (step) {
      case 1: // 考点提问 → 下一步：真题演练
        actions = [
          { action: 'practice', label: '来一道真题', icon: '✏️', prompt: AppConfig.defaults.actionPrompts.practice },
        ];
        break;
      case 2: // 真题演练 → 下一步：错因分析 / 举一反三
        actions = [
          { action: 'analysis', label: '查看解析', icon: '💡', prompt: '' },
          { action: 'extend', label: '举一反三', icon: '🔄', prompt: AppConfig.defaults.actionPrompts.extend },
        ];
        break;
      case 3: // 错因分析 → 下一步：举一反三
        actions = [
          { action: 'extend', label: '再练几道类似的', icon: '🔄', prompt: AppConfig.defaults.actionPrompts.extend },
          { action: 'ask-knowledge', label: '换个考点', icon: '📚', prompt: '' },
        ];
        break;
      case 4: // 举一反三 → 循环
        actions = [
          { action: 'practice', label: '继续练习', icon: '✏️', prompt: AppConfig.defaults.actionPrompts.practice },
          { action: 'ask-knowledge', label: '回到考点', icon: '📖', prompt: '' },
        ];
        break;
    }

    const barHtml = Renderer.createQuickReplies(actions);
    if (barHtml) {
      const body = currentAiMsgEl.querySelector('.message__body');
      if (body) {
        body.insertAdjacentHTML('beforeend', barHtml);

        // 绑定快捷按钮事件
        body.querySelectorAll('.quick-reply-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const customPrompt = btn.dataset.prompt ? decodeURIComponent(btn.dataset.prompt) : '';

            // 更新步骤
            const stepMap = { 'ask-knowledge': 1, 'practice': 2, 'analysis': 3, 'extend': 4 };
            if (stepMap[action]) UI.setStep(stepMap[action]);

            if (customPrompt) {
              sendMessage(customPrompt);
            } else {
              sendAction(action);
            }
          });
        });
      }
    }
  }

  /* ════════════════════
     练习题交互处理
     ════════════════════ */

  window.Chat = window.Chat || {};
  window.Chat.handleOptionClick = function(optionEl, msgId) {
    // 如果已经作答过，忽略
    if (optionEl.closest('.practice-options')?.classList.contains('practice-options--answered')) return;

    const optionsContainer = optionEl.closest('.practice-options');
    if (!optionsContainer) return;

    optionsContainer.classList.add('practice-options--answered');

    const userIndex = parseInt(optionEl.dataset.index);

    // TODO: 这里需要从后端获取正确答案和解析
    // 暂时模拟：假设 B (index=1) 是正确答案
    const correctIndex = 1; // 模拟数据，实际应从 Coze 返回

    const isCorrect = userIndex === correctIndex;

    // 更新步骤
    if (isCorrect) {
      UI.setStep(4); // 答对了 → 举一反三
    } else {
      UI.setStep(3); // 答错了 → 错因分析
    }

    // 渲染结果
    const card = optionEl.closest('.practice-card');
    if (card) {
      const explanation = isCorrect
        ? '回答正确！该题考查了关系代数的核心概念。'
        : '回答错误。正确答案是 B。原因在于...';

      Renderer.showPracticeResult(
        card,
        isCorrect,
        correctIndex,
        explanation,
        userIndex,
        correctIndex,
      );

      // 如果答错了，自动触发错因分析
      if (!isCorrect) {
        setTimeout(() => {
          sendMessage(AppConfig.defaults.actionPrompts.analysis.replace('{chapter}', UI.getActiveChapter().name));
        }, 800);
      }
    }

    UI.scrollToBottom();
  };

  /* ════════════════════
     辅助方法
     ════════════════════ */

  function finalizeAiMessage() {
    if (currentAiMsgEl) {
      const contentEl = currentAiMsgEl.querySelector('.message__content');
      if (contentEl) Renderer.finalizeMessage(contentEl);
    }
    currentAiMsgEl = null;
  }

  function getCurrentTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function saveCurrentSession() {
    const messages = [];
    if (dom.chatAreaInner) {
      dom.chatAreaInner.querySelectorAll('.message').forEach((el) => {
        const role = el.classList.contains('message--user') ? 'user' : 'ai';
        const contentEl = el.querySelector('.message__content');
        messages.push({
          role,
          content: contentEl ? contentEl.textContent : '',
          timestamp: Date.now(),
        });
      });
    }

    if (messages.length > 0) {
      History.save({
        id: conversationId || 'session_' + Date.now(),
        messages,
        createdAt: Date.now(),
        chapter: UI.getActiveChapter()?.name,
        summary: History.generateSummary(messages),
      });
    }
  }

  function updateSendBtnState() {
    if (dom.sendBtn) {
      dom.sendBtn.disabled = !dom.inputField?.value.trim() || isStreaming;
    }
  }

  /**
   * 输入框自动高度调整
   */
  function adjustInputHeight() {
    if (dom.inputField) {
      dom.inputField.style.height = 'auto';
      dom.inputField.style.height = Math.min(dom.inputField.scrollHeight, 120) + 'px';
    }
  }

  /**
   * 恢复历史会话
   */
  function restoreSession(sessionData) {
    if (!sessionData || !sessionData.messages) return;

    // 清空当前聊天区（保留欢迎卡片隐藏状态）
    UI.hideWelcome();
    clearMessages();

    // 逐条渲染消息
    sessionData.messages.forEach((msg) => {
      if (msg.role === 'user') {
        appendUserBubble(msg.content);
      } else {
        createAiBubble(msg.content);
      }
    });

    conversationId = sessionData.id;
    UI.scrollToBottom();
  }

  function clearMessages() {
    if (dom.chatAreaInner) {
      // 移除所有消息，保留欢迎卡片
      dom.chatAreaInner.querySelectorAll('.message').forEach((el) => el.remove());
    }
    messageCount = 0;
  }

  function reset() {
    Api.abort();
    hideTypingIndicator();
    isStreaming = false;
    conversationId = null;
    currentAiMsgEl = null;
    clearMessages();
    UI.showWelcome();
    UI.setStep(1);
    updateSendBtnState();
  }

  return {
    bindDom,
    sendMessage,
    sendAction,
    handleOptionClick: window.Chat.handleOptionClick,
    updateSendBtnState,
    adjustInputHeight,
    restoreSession,
    reset,
  };
})();
