/* ============================================
   AI 期末私教 — API 通信层
   封装与后端的 HTTP / SSE 通信
   ============================================ */

const Api = (() => {
  const baseUrl = AppConfig.apiBaseUrl;
  let currentController = null;

  /**
   * 发送聊天消息（SSE 流式）
   * @param {string} message - 用户消息文本
   * @param {string} [conversationId] - 会话 ID（可选，首次不传）
   * @param {object} onEvent - 事件回调
   * @returns {Promise<void>}
   */
  async function chatStream(message, conversationId, onEvent = {}) {
    abort();

    const url = `${baseUrl}${AppConfig.endpoints.chat}`;
    const body = {
      message,
      user_id: getUserId(),
    };
    if (conversationId) {
      body.conversation_id = conversationId;
    }

    currentController = new AbortController();
    console.log('[API] 发起聊天请求:', url, body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: currentController.signal,
      });

      console.log('[API] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[API] HTTP 错误:', response.status, errText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await readSSEStream(response, onEvent);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[API] 请求已取消');
        return;
      }

      console.error('[API] 请求失败:', error);
      if (onEvent.error) {
        onEvent.error(error.message || '网络连接失败，请检查后端服务是否启动');
      }
    }
  }

  /**
   * 读取 SSE 事件流
   */
  async function readSSEStream(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message'; // 默认事件类型

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的一行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            // 空行 = 当前事件结束，重置
            currentEvent = 'message';
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            console.log('[API] SSE event type:', currentEvent);
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            console.log('[API] SSE data raw:', dataStr.substring(0, 200));

            try {
              const data = JSON.parse(dataStr);
              // 注入事件类型
              data.type = currentEvent;
              console.log('[API] SSE parsed:', data.type, data);
              handleSSEData(data, onEvent);
            } catch (e) {
              console.warn('[API] JSON 解析失败，当作纯文本:', dataStr.substring(0, 100));
              handleSSEData({ type: currentEvent, content: dataStr }, onEvent);
            }
            continue;
          }
        }
      }

      // 流结束
      if (onEvent.done) onEvent.done();
    } finally {
      reader.releaseLock();
      currentController = null;
    }
  }

  /**
   * 处理 SSE 数据事件分发
   */
  function handleSSEData(data, onEvent) {
    switch (data.type) {
      case 'message':
        if (onEvent.message) onEvent.message(data.content || '');
        break;
      case 'citation':
        if (onEvent.citation) onEvent.citation(data);
        break;
      case 'practice':
        if (onEvent.practice) onEvent.practice(data);
        break;
      case 'done':
        if (onEvent.done) onEvent.done(data.conversation_id);
        break;
      case 'error':
        if (onEvent.error) onEvent.error(data.message || '服务器返回错误');
        break;
      default:
        // 未知的 type，尝试当消息处理
        if (data.content && onEvent.message) {
          onEvent.message(data.content);
        }
    }
  }

  /**
   * 取消当前正在进行的请求
   */
  function abort() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  }

  /**
   * 获取/生成用户 ID（基于 localStorage 的简单方案）
   */
  function getUserId() {
    let userId = localStorage.getItem('ai-tutor-user-id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('ai-tutor-user-id', userId);
    }
    return userId;
  }

  /**
   * 检查后端是否可用（健康检查）
   */
  async function healthCheck() {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return {
    chatStream,
    abort,
    healthCheck,
    getUserId,
  };
})();
