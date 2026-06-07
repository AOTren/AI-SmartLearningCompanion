# AI 期末私教 — 后端服务

> FastAPI 中间层，负责转发前端请求到 Coze Open API，并以 SSE 流式返回 AI 回复。

---

## 文件结构

```
backend/
├── app.py                     # FastAPI 主入口
├── config.py                  # 配置管理（读取 .env）
├── requirements.txt           # Python 依赖清单
├── .env.example               # 环境变量模板（复制为 .env 并填值）
├── env_editor.py              # 图形化 .env 配置编辑器（源码）
├── 配置编辑器.exe              # 图形化 .env 配置编辑器（双击运行）
│
├── models/
│   └── schemas.py          # Pydantic 请求/响应数据模型
│
├── services/
│   └── coze_client.py     # Coze Open API v3 封装（SSE 流式）
│
└── routes/
    └── chat.py             # /api/chat 路由（SSE 流式对话）
```

---

## 快速开始

### 方式一：使用图形化配置编辑器（推荐 🎉）

**双击 `配置编辑器.exe`** 即可打开可视化 .env 编辑面板，无需手动编辑文本文件。

> ⚠️ `配置编辑器.exe` 必须与 `app.py` 放在同一目录（`backend/`）下才能正确定位配置文件。

#### 界面说明

| 区域 | 说明 |
|------|------|
| 🔑 Coze API 配置 | 填写 API Token（`pat_xxx`）和 Bot ID，**必填** |
| ⚙️ 服务配置 | 监听地址、端口、CORS 来源，保持默认即可 |
| 🕐 高级设置 | 超时时间、心跳间隔、日志级别 |

#### 操作按钮

| 按钮 | 功能 |
|------|------|
| 💾 保存配置 | 将表单内容写入 `backend/.env` 文件 |
| 🚀 保存并启动后端 | 保存配置后，在新终端窗口中自动运行 `python app.py` |
| 📄 直接编辑文件 | 用记事本打开 `.env` 文件手动修改 |

> 💡 **密码字段**（API Token）右侧的 👁 按钮可切换显示/隐藏内容。

---

### 方式二：手动配置（命令行）

### 1. 准备环境变量

```bash
cd backend
cp .env.example .env
```

然后编辑 `.env`，填入真实值：

```env
COZE_API_KEY=pat_xxxxxxxxxxxxxxxxxxxx
COZE_BOT_ID=bot_xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ `.env` 包含敏感信息，**切勿提交到 Git**。

### 2. 创建虚拟环境（推荐）

```bash
cd E:/AI课代表/backend

# 创建虚拟环境
"C:/Users/yt/.workbuddy/binaries/python/versions/3.13.12/python.exe" -m venv venv

# 激活（Windows Git Bash）
激活虚拟环境
创建完成后，需要“进入”这个环境才能生效。不同系统的激活命令如下：
Windows (CMD)：.\venv\Scripts\activate.bat
Windows (PowerShell)：.\venv\Scripts\Activate.ps1
Linux / macOS：source venv/bin/activate

source venv/Scripts/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 启动服务

```bash
python app.py
```

启动成功后：

| 地址 | 说明 |
|------|------|
| `http://localhost:8000` | 服务根路径（自动跳转到文档） |
| `http://localhost:8000/docs` | **Swagger UI**（强烈推荐，可在线调试 API） |
| `http://localhost:8000/health` | 健康检查 |

---

## API 接口说明

### POST `/api/chat` — 流式对话

**请求：**

```json
{
  "message": "数据库的范式有哪些？",
  "user_id": "user_001",
  "conversation_id": "可选，续接上下文"
}
```

**响应：** `text/event-stream`（SSE）

| event 类型 | data 内容 | 说明 |
|------------|-----------|------|
| `message` | `{"content": "文本片段"}` | AI 回复的增量内容 |
| `citation` | `{"citations": [...]}` | 引用来源（可选） |
| `practice` | `{"question": "...", "options": [...], ...}` | 练习题数据（可选） |
| `done` | `{"conversation_id": "..."}` | 流结束 |
| `error` | `{"message": "错误信息"}` | 出错 |

**curl 测试：**

```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好", "user_id": "test"}'
```

---

## Coze API 配置说明

### 获取 PAT（Personal Access Token）

1. 登录 [Coze 开放平台](https://www.coze.cn/open)
2. 进入「个人设置」→「API 令牌」
3. 新建令牌，复制 `pat_xxx` 填入 `.env` 的 `COZE_API_KEY`

### 获取 Bot ID**

打开你的 Coze Bot 编辑页面，URL 中即有 Bot ID，例如：

```
https://www.coze.cn/space/xxx/bot/obot_xxxxxxxxxxxxxxxxxxxx
                                            ^^^^^^^^^^^^^^^^^^^^
                                            这就是 bot_id
```

填入 `.env` 的 `COZE_BOT_ID`。

---

## 常见问题

### Q：启动后前端连不上？

检查 `backend/.env` 中的 `CORS_ORIGINS` 是否包含前端地址。
开发阶段可临时设为 `["*"]`（**生产环境请勿这样做**）。

### Q：Coze API 返回 401？

- 检查 `COZE_API_KEY` 是否填写正确（以 `pat_` 开头）
- 确认 PAT 未过期，且有权限访问该 Bot

### Q：SSE 流中断 / 超时？

- 检查网络是否能访问 `api.coze.cn`
- 增大 `.env` 中 `COZE_TIMEOUT` 的值（默认 120 秒）

### Q：想在生产环境运行？

```bash
# 使用 gunicorn + uvicorn worker
pip install gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | ≥0.110.0 | 异步 Web 框架 |
| uvicorn | ≥0.29.0 | ASGI 服务器 |
| httpx | ≥0.27.0 | 异步 HTTP 客户端（调 Coze API） |
| pydantic | ≥2.6.0 | 数据校验 & 类型提示 |
| python-dotenv | ≥1.0.0 | `.env` 文件加载 |
