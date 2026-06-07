"""
AI 期末私教 — 聊天路由
/api/chat  — 接收用户消息，调用 Coze API，SSE 流式转发
"""
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from starlette.responses import Response

from models.schemas import ChatRequest, EventType
from services import coze_client as coze
from config import config

logger = logging.getLogger("routes.chat")
router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(request: ChatRequest = Body(...)):
    """
    对话接口（SSE 流式）

    请求体：
    {
      "message": "用户的问题",
      "user_id": "user_001",
      "conversation_id": "可选，续接上下文"
    }

    响应：text/event-stream
    事件类型：
      - message   ：AI 回复文本增量
      - citation  ：引用来源数据
      - practice  ：练习题数据
      - done      ：流结束（含 conversation_id）
      - error     ：错误信息
    """

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="message 不能为空")

    # 校验配置（首次调用时触发）
    try:
        config.validate()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(
        f"收到消息 user_id={request.user_id}  conversation_id={request.conversation_id or '新会话'}"
    )

    # 调用 Coze 并获取 SSE 流
    return await coze.chat_stream(
        message=request.message,
        user_id=request.user_id,
        conversation_id=request.conversation_id,
    )


@router.get("/chat/health")
async def chat_health():
    """聊天模块健康检查（含 Coze 连通性检测）"""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{config.coze_api_base()}/health",
                headers={"Authorization": f"Bearer {config.COZE_API_KEY}"},
            )
            coze_ok = 200 <= resp.status_code < 400
    except Exception:
        coze_ok = False

    return {
        "status": "ok",
        "coze_connected": coze_ok,
        "bot_id": config.COZE_BOT_ID[:10] + "..." if config.COZE_BOT_ID else None,
    }
