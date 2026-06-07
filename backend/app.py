"""
AI 期末私教 — FastAPI 主入口
启动：uvicorn app:app --reload --host 0.0.0.0 --port 8000
"""
import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# ── 项目根目录 ──
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# ── 日志配置 ──
logging.basicConfig(
    level=logging.getLevelName("INFO"),
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("app")

# ── 创建 FastAPI 应用 ──
app = FastAPI(
    title="AI 期末私教 — 后端中间层",
    description="Coze API 中间层，提供 SSE 流式对话接口",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS 中间件 ──
# 允许前端域名访问（从配置读取，默认允许本地开发）
try:
    from config import config

    allow_origins = config.CORS_ORIGINS
except Exception:
    allow_origins = ["*"]  # 开发阶段，生产环境请收紧

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── 健康检查 ──
@app.get("/health", tags=["system"], summary="健康检查")
def health_check():
    """服务健康检查接口（前端、负载均衡器调用）"""
    return {"status": "ok", "version": "1.0.0"}


# ── 注册路由 ──
try:
    from routes import chat

    app.include_router(chat.router)
    logger.info("✅ 路由加载成功：/api/chat")
except Exception as e:
    logger.warning(f"⚠️ 路由加载失败：{e}")
    import traceback
    logger.warning(traceback.format_exc())


# ── 启动时打印所有路由 + 配置诊断 ──
@app.on_event("startup")
async def startup_diagnostics():
    # 打印路由
    routes = [r.path for r in app.routes if hasattr(r, 'path')]
    logger.info(f"📋 已注册路由: {routes}")
    if '/api/chat' not in routes:
        logger.warning("⚠️ /api/chat 路由未注册，请检查 routes/chat.py 是否正确加载")

    # 配置诊断
    from config import config
    logger.info(f"🔧 配置诊断:")
    logger.info(f"   COZE_BASE_URL = {config.COZE_BASE_URL}")
    logger.info(f"   COZE_BOT_ID   = {config.COZE_BOT_ID!r}")
    logger.info(f"   COZE_API_KEY  = {'已填写(' + config.COZE_API_KEY[:10] + '...)' if config.COZE_API_KEY else '❌ 未填写！'}")
    logger.info(f"   HOST           = {config.HOST}")
    logger.info(f"   PORT           = {config.PORT}")
    logger.info(f"   LOG_LEVEL      = {config.LOG_LEVEL}")

    # 校验关键配置
    try:
        config.validate()
        logger.info("✅ 关键配置校验通过")
    except ValueError as e:
        logger.error(f"❌ 配置校验失败: {e}")


# ── 根路径：返回前端页面 ──
@app.get("/", include_in_schema=False)
def root():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return RedirectResponse(url="/docs")


# ── 前端静态文件托管 ──
# 所有 API 路由注册完成后再挂载静态文件，避免路由冲突
# 排除 /docs, /redoc, /openapi.json 等内置路由
_EXCLUDED_PATHS = {"/docs", "/redoc", "/openapi.json"}

if FRONTEND_DIR.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """前端 SPA 路由 fallback：优先找静态文件，找不到返回 index.html"""
        request_path = "/" + full_path
        if request_path in _EXCLUDED_PATHS:
            # 让 FastAPI 内置路由处理
            from fastapi.responses import Response
            return Response(status_code=404)

        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # SPA 路由 fallback
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    logger.info(f"✅ 前端静态文件已挂载：{FRONTEND_DIR}")
else:
    logger.warning(f"⚠️ 前端目录不存在：{FRONTEND_DIR}，仅提供 API 服务")


# ── 全局异常处理器 ──
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    logger.exception(f"未捕获异常: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )


# ── 启动入口 ──
if __name__ == "__main__":
    import os

    host = os.getenv("HOST", "0.0.0.0") or "0.0.0.0"
    _port_raw = os.getenv("PORT", "8000") or "8000"
    port = int(_port_raw)

    logger.info(f"🚀 启动 AI 期末私教后端：http://{host}:{port}")
    logger.info(f"   文档地址：http://{host}:{port}/docs")

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )
