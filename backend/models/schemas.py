"""
AI 期末私教 — 请求/响应数据模型
使用 Pydantic 做参数校验和类型提示
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ─────────────────────────────────────
# 聊天接口
# ─────────────────────────────────────

class ChatRequest(BaseModel):
    """/api/chat 请求体"""

    message: str = Field(..., description="用户输入的消息文本", min_length=1, max_length=8000)
    user_id: str = Field(default="default_user", description="用户唯一标识")
    conversation_id: Optional[str] = Field(default=None, description="会话 ID（续接上下文时用）")


class ChatHistoryItem(BaseModel):
    """单条对话历史（用于转发给 Coze）"""

    role: str = Field(..., description="'user' 或 'assistant'")
    content: str = Field(..., description="消息内容")
    content_type: str = Field(default="text", description="内容类型：text / object_string / card")


class CozeChatRequest(BaseModel):
    """转发给 Coze Open API 的请求体"""

    bot_id: str = Field(..., description="Coze Bot ID")
    user_id: str = Field(..., description="用户 ID")
    additional_messages: List[ChatHistoryItem] = Field(
        default_factory=list, description="本次新增消息（通常只有 1 条用户消息）"
    )
    chat_history: Optional[List[ChatHistoryItem]] = Field(
        default=None, description="历史对话（可选，Coze 会自行管理）"
    )
    stream: bool = Field(default=True, description="是否使用 SSE 流式返回")
    auto_save_history: bool = Field(default=True, description="是否让 Coze 自动保存历史")


# ─────────────────────────────────────
# SSE 事件格式（向后端前端发送）
# ─────────────────────────────────────

class SSEvent(BaseModel):
    """SSE 事件统一格式"""

    event: str = Field(..., description="事件类型")
    data: Dict[str, Any] = Field(default_factory=dict, description="事件数据")


# 预定义事件类型
class EventType:
    MESSAGE = "message"  # AI 回复文本增量
    CITATION = "citation"  # 引用来源
    PRACTICE = "practice"  # 练习题数据
    DONE = "done"  # 流结束
    ERROR = "error"  # 错误


# ─────────────────────────────────────
# 练习题（从 Coze 返回中解析）
# ─────────────────────────────────────

class PracticeOption(BaseModel):
    label: str
    text: str


class PracticeData(BaseModel):
    question: str
    options: List[str] = Field(default_factory=list)
    answer: Optional[str] = None
    explanation: Optional[str] = None


# ─────────────────────────────────────
# 引用来源
# ─────────────────────────────────────

class CitationItem(BaseModel):
    filename: str = ""
    location: str = ""  # 如 "第 12 页" / "Slide: 范式定义"
    score: float = 0.0  # 匹配度 0~100


# ─────────────────────────────────────
# 健康检查
# ─────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    coze_connected: bool = False
