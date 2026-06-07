"""
AI 期末私教 — Coze API 客户端
封装对 Coze Open API v3 的调用，支持 SSE 流式转发
"""
import json
import logging
from typing import Optional, Tuple

from starlette.responses import StreamingResponse

import httpx

from config import config

logger = logging.getLogger("coze_client")

# ── Coze SSE 事件类型（v3 标准）──


class CozeSSEvent:
    """Coze 返回的 SSE event 类型常量"""

    # 对话创建
    CHAT_CREATED = "conversation.chat.created"
    # 对话进行中
    CHAT_IN_PROGRESS = "conversation.chat.in_progress"
    # 消息内容增量（流式核心）
    MESSAGE_DELTA = "conversation.message.delta"
    # 消息完成
    MESSAGE_COMPLETE = "conversation.message.complete"
    # 对话完成（含 chat_id 等最终信息）
    CHAT_COMPLETED = "conversation.chat.completed"
    # 错误
    ERROR = "error"


async def chat_stream(
    message: str,
    user_id: str,
    conversation_id: Optional[str] = None,
) -> StreamingResponse:
    """
    调用 Coze API 并转发 SSE 流给前端

    参数：
        message: 用户输入文本
        user_id: 用户 ID
        conversation_id: 会话 ID（续接时用）

    返回：
        StreamingResponse — 直接透传给前端
    """

    url = f"{config.coze_api_base()}/chat"

    headers = {
        "Authorization": f"Bearer {config.COZE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Agw-Channel": "api",  # Coze 要求的 Channel 头
    }

    payload = {
        "bot_id": config.COZE_BOT_ID,
        "user_id": user_id,
        "additional_messages": [
            {
                "role": "user",
                "content": message,
                "content_type": "text",
            }
        ],
        "stream": True,
        "auto_save_history": True,
    }

    logger.info(f"[DEBUG] 发送 Coze: bot_id={config.COZE_BOT_ID!r}, user={user_id!r}, msg='{message[:30]}'")

    if conversation_id:
        payload["conversation_id"] = conversation_id

    # ── SSE 生成器 ──
    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=config.COZE_TIMEOUT) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:

                    status_code = resp.status_code
                    content_type = resp.headers.get("content-type", "")
                    logger.info(f"Coze 响应: status={status_code}, content_type={content_type}")

                    if status_code != 200:
                        error_text = await resp.aread()
                        logger.error(f"Coze API 错误 {status_code}: {error_text}")
                        yield _sse_event("error", {"message": f"Coze API 返回 {status_code}"})
                        return

                    # 逐行读取 SSE 流
                    current_event_type = ""
                    data_lines_buffer = []
                    total_lines = 0

                    async for raw_line in resp.aiter_lines():
                        total_lines += 1
                        line = raw_line.strip()

                        if not line:
                            # 空行 = 当前事件结束，处理缓冲区
                            if current_event_type and data_lines_buffer:
                                full_data_str = "\n".join(data_lines_buffer)
                                for sse_chunk in _process_coze_event(
                                    current_event_type, full_data_str
                                ):
                                    yield sse_chunk
                            current_event_type = ""
                            data_lines_buffer = []
                            continue

                        # 解析 event: 行
                        if line.startswith("event:"):
                            current_event_type = line[len("event:"):].strip()
                            continue

                        # 解析 data: 行
                        if line.startswith("data:"):
                            data_content = line[len("data:"):].strip()

                            # [DONE] 结束标记
                            if data_content == "[DONE]":
                                logger.info(f"SSE 流结束（[DONE]），共处理 {total_lines} 行")
                                yield _sse_event("done", {"conversation_id": conversation_id or ""})
                                return

                            data_lines_buffer.append(data_content)
                            continue

                    # 流结束时处理最后一条未 flush 的事件
                    if current_event_type and data_lines_buffer:
                        full_data_str = "\n".join(data_lines_buffer)
                        for sse_chunk in _process_coze_event(
                            current_event_type, full_data_str
                        ):
                            yield sse_chunk

                    logger.info(f"SSE 流读取完毕，共 {total_lines} 行")
                    yield _sse_event("done", {"conversation_id": conversation_id or ""})

        except httpx.TimeoutException:
            logger.error("Coze API 请求超时")
            yield _sse_event("error", {"message": "请求超时，请稍后重试"})
        except Exception as e:
            logger.exception(f"Coze API 调用异常: {e}")
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── 内部工具函数 ──


def _sse_event(event: str, data: dict) -> str:
    """构造 SSE 格式字符串"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _process_coze_event(event_type: str, data_str: str):
    """
    解析 Coze SSE 事件的 data 字符串，yield 前端可读的 SSE 块。

    Coze v3 可能返回的数据格式（已知的几种）：

    格式A — 嵌套包装：
        {"type":"message","data":{"content":"你好"}}
        → 需要剥掉外层 .get("data") 取内层

    格式B — 扁平内容：
        {"content":"你好"}
        → 直接使用

    格式C — 字符串（罕见但存在）：
        "你好"
        → 整体作为消息文本

    格式D — 多行 data 拼接：
        多个 JSON 行拼在一起
        → 逐段解析
    """
    logger.debug(f"[EVENT] type={event_type!r}, data前80字={data_str[:80]!r}")

    # ── 尝试直接解析为 JSON ──
    parsed = None
    try:
        parsed = json.loads(data_str)

        # 如果是字符串类型（如 '"hello"'），包装成对象
        if isinstance(parsed, str):
            logger.debug(f"[EVENT] data 是纯字符串: {parsed[:60]}")
            if event_type == CozeSSEvent.MESSAGE_DELTA:
                yield _sse_event("message", {"content": parsed})
            return

        # 如果是列表（罕见），逐项处理
        if isinstance(parsed, list):
            logger.debug(f"[EVENT] data 是列表，共 {len(parsed)} 项")
            for item in parsed:
                result = _extract_message_from_coze_obj(item, event_type)
                if result:
                    yield result
            return

        # 如果是 dict，正常处理
        if isinstance(parsed, dict):
            result = _extract_message_from_coze_obj(parsed, event_type)
            if result:
                yield result
            return

    except json.JSONDecodeError as e:
        logger.debug(f"[EVENT] JSON 解析失败: {e}")

    # ── JSON 解析失败：尝试拆分多段 ──
    segments = list(_split_json_objects(data_str))
    if segments and len(segments) >= 1:
        for seg in segments:
            try:
                obj = json.loads(seg)
                result = _extract_message_from_coze_obj(obj, event_type)
                if result:
                    yield result
            except json.JSONDecodeError:
                # 完全无法解析，当作原始文本发出
                if seg.strip() and event_type == CozeSSEvent.MESSAGE_DELTA:
                    logger.debug(f"[EVENT] 无法解析，当原文发送: {seg[:40]}")
                    yield _sse_event("message", {"content": seg.strip()})
        return

    # ── 完全无法解析：如果这是 delta 事件，把原文当消息发出 ──
    if event_type == CozeSSEvent.MESSAGE_DELTA and data_str.strip():
        logger.debug(f"[EVENT] 最终兜底，原文发送")
        yield _sse_event("message", {"content": data_str})


def _extract_message_from_coze_obj(obj: dict, event_type: str):
    """
    从 Coze 返回的 JSON 对象中提取有效信息，
    返回 SSE 字符串 或 None（表示跳过该事件）。
    """
    if not isinstance(obj, dict):
        return None

    # ── 剥掉一层包装：很多 Coze 事件有 {"type":"...", "data": {...}} 结构 ──
    inner = obj.get("data", obj)
    # 如果剥出来的仍然是字符串（不是 dict），再尝试解析一次
    if isinstance(inner, str):
        try:
            inner = json.loads(inner)
        except json.JSONDecodeError:
            pass

    if not isinstance(inner, dict):
        # inner 不是 dict，无法继续提取
        return None

    # ── 根据事件类型提取不同字段 ──
    if event_type == CozeSSEvent.MESSAGE_DELTA:
        # 核心：流式文本增量
        content = inner.get("content", "")
        if content:
            return _sse_event("message", {"content": content})
        return None

    elif event_type == CozeSSEvent.MESSAGE_COMPLETE:
        # 消息完成：可能附带引用、练习题等结构化数据
        citations = inner.get("citations", [])
        practice = inner.get("practice", None)
        role = inner.get("role", "")

        # 如果有引用
        if citations:
            return _sse_event("citation", {"citations": citations})
        # 如果有练习题
        if practice:
            return _sse_event("practice", practice)
        # 否则不产生事件（MESSAGE_COMPLETE 本身不需要向前端展示）

        return None

    elif event_type == CozeSSEvent.CHAT_COMPLETED:
        # 对话完成：返回 chat_id / conversation_id 用于续接
        chat_id = inner.get("id") or inner.get("chat_id") or ""
        conversation_id_out = inner.get("conversation_id", "")
        return _sse_event("done", {
            "conversation_id": conversation_id_out or chat_id,
        })

    elif event_type == CozeSSEvent.ERROR:
        msg = inner.get("msg") or inner.get("message", "未知错误")
        return _sse_event("error", {"message": msg})

    # 其他事件（CHAT_CREATED、CHAT_IN_PROGRESS 等）→ 不向前端推送
    return None


def _split_json_objects(s: str):
    """将可能拼接在一起的多个 JSON 对象拆分开"""
    depth = 0
    current = []
    in_string = False
    escape_next = False

    for ch in s:
        if escape_next:
            current.append(ch)
            escape_next = False
            continue
        if ch == '\\' and in_string:
            current.append(ch)
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
        if not in_string:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
        current.append(ch)
        if depth == 0 and current:
            yield "".join(current)
            current = []

    if current and depth == 0:
        yield "".join(current)
