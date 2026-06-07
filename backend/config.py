"""
AI 期末私教 — 配置管理模块
从 .env 文件加载环境变量，提供全局配置访问
采用惰性读取，避免 uvicorn reload 时类属性过期
"""
import os
import json
from pathlib import Path
from typing import List, Optional

try:
    from dotenv import load_dotenv

    # 加载 .env 文件（优先使用项目根目录下的 .env）
    BASE_DIR = Path(__file__).resolve().parent
    load_dotenv(BASE_DIR / ".env", override=True)  # override=True 确保 reload 时重新加载
except ImportError:
    # 若未安装 python-dotenv，则仅从系统环境变量读取
    pass


# ── 工具函数 ─────────────────────────────────────────

def _getenv_str(key: str, default: str) -> str:
    val = os.getenv(key)
    if val is None or val == "":
        return default
    return val


def _getenv_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if not raw:
        return default
    try:
        return int(raw)
    except (ValueError, TypeError):
        return default


def _getenv_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if not raw:
        return default
    try:
        return float(raw)
    except (ValueError, TypeError):
        return default


def _parse_list(key: str, default: List[str]) -> List[str]:
    """将逗号分隔的环境变量解析为列表"""
    raw = os.getenv(key)
    if not raw:
        return default
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    return [x.strip().strip("'\"") for x in raw.split(",") if x.strip()]


# ── 配置类（惰性属性，每次访问都从环境变量读取）─────────────

class Config:
    """应用配置类 — 所有属性通过 @property 惰性读取，避免 reload 缓存问题"""

    @property
    def COZE_API_KEY(self) -> str:
        return _getenv_str("COZE_API_KEY", "")

    @property
    def COZE_BOT_ID(self) -> str:
        """Coze Bot ID（直接填 .env 中的原始值，不加任何前缀）"""
        raw = _getenv_str("COZE_BOT_ID", "")
        # 兼容：如果用户填了 bot_ 前缀则去掉
        if raw.startswith("bot_"):
            return raw[4:]
        return raw

    @property
    def COZE_BASE_URL(self) -> str:
        return _getenv_str("COZE_BASE_URL", "https://api.coze.cn")

    @property
    def COZE_API_VERSION(self) -> str:
        return _getenv_str("COZE_API_VERSION", "/v3")

    def coze_api_base(self) -> str:
        return f"{self.COZE_BASE_URL}{self.COZE_API_VERSION}"

    @property
    def HOST(self) -> str:
        return _getenv_str("HOST", "0.0.0.0")

    @property
    def PORT(self) -> int:
        return _getenv_int("PORT", 8000)

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return _parse_list(
            "CORS_ORIGINS",
            [
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "null",
            ],
        )

    @property
    def SSE_HEARTBEAT_INTERVAL(self) -> int:
        return _getenv_int("SSE_HEARTBEAT_INTERVAL", 15)

    @property
    def COZE_TIMEOUT(self) -> float:
        return _getenv_float("COZE_TIMEOUT", 120.0)

    @property
    def LOG_LEVEL(self) -> str:
        return _getenv_str("LOG_LEVEL", "INFO")

    def validate(self) -> None:
        """启动时校验关键配置是否填写"""
        missing = []
        if not self.COZE_API_KEY:
            missing.append("COZE_API_KEY")
        if not self.COZE_BOT_ID:
            missing.append("COZE_BOT_ID")
        if missing:
            raise ValueError(
                f"❌ 缺少关键环境变量，请在 backend/.env 中填写：{', '.join(missing)}\n"
                f"   参考 backend/.env.example 文件。"
            )


# 全局配置实例（单例）
config = Config()
