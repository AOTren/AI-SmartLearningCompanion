# AI 期末私教

> **把 50+ 份杂乱课件，变成一个懂考点、会出题、能纠错的 24 小时 AI 私教。**

基于 Coze 平台 RAG 技术的智能期末伴学应用 —— 前端对话界面 + FastAPI 中间层 + Coze 智能体。
成功启用示例图
![image-20260607215258433](C:\Users\yt\AppData\Roaming\Typora\typora-user-images\image-20260607215258433.png)

---

## 项目背景

高校期末复习阶段，学生普遍面临**信息过载、复习无重点**的痛点：

- 课程课件 50+ 份（PPT/Word/PDF），内容碎片化，不知道从何看起
- PPT 中包含 ER 图、流程图、公式等**多模态内容**，纯文本检索无法覆盖
- 传统"看书→做题→对答案"模式缺少主动引导和错因追踪

本项目通过 **RAG（检索增强生成）技术** 将碎片化课件转化为结构化知识库，配合 **"考点提问 → 真题演练 → 错因分析 → 举一反三"** 的四步伴学工作流，提供个性化 AI 辅导体验。

---

## 核心功能

### 🎯 四步伴学工作流

```
① 考点提问          ② 真题演练           ③ 错因分析            ④ 举一反三
"这章考什么？"    "来一道题试试"      "我为什么错了？"     "再给我类似的"
     │                  │                    │                     │
     └──────────────────┴────────────────────┴─────────────────────┘
                                        多轮循环
```

### 功能清单

| 模块 | 功能 | 说明 |
|------|------|------|
| 💬 | 智能对话 | 多轮对话、SSE 流式输出、Markdown/公式渲染 |
| 📘 | 章节导航 | 课程目录树、快捷聚焦章节 |
| ⚡ | 伴学工作流 | 四步闭环学习流程 + 快捷操作按钮 |
| 🔖 | 引用溯源 | 知识来源标注（文件名 + 页码 + 匹配度） |
| 📝 | 练习交互 | 选择题点击交互、即时正误反馈 |
| 💾 | 历史记录 | 本地存储、会话恢复、导出 Markdown |
| 🎨 | 界面定制 | 明暗主题切换、侧栏收起/展开 |
| 📱 | 响应式适配 | 桌面 / 平板 / 移动端自适应 |

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| HTML5 / CSS3 / ES6+ | - | 原生开发，零构建工具链 |
| [marked.js](https://marked.js.org/) | latest (CDN) | Markdown 渲染 |
| [KaTeX](https://katex.org/) | latest (CDN) | 数学公式渲染 |
| [highlight.js](https://highlightjs.org/) | latest (CDN) | 代码块语法高亮 |
| Fetch API + SSE | - | 与后端通信 |

### 后端中间层

| 技术 | 版本 | 用途 |
|------|------|------|
| Python FastAPI | ≥0.110.0 | 异步 Web 框架，原生 SSE 支持 |
| httpx | ≥0.27.0 | 异步 HTTP 客户端（调用 Coze API） |
| python-dotenv | ≥1.0.0 | 环境变量管理 |
| uvicorn | ≥0.29.0 | ASGI 服务器 |

### AI 底座

| 平台 | 说明 |
|------|------|
| **Coze（扣子）** | 智能体搭建与知识库管理 |
| **Coze Open API** | `/v3/chat` 流式接口 |

---

## 项目结构

```
AI课代表/
├── PRD.md                          # 产品需求文档
├── README.md                       # 项目说明文件（本文件）
│
├── backend/                        # 后端中间层
│   ├── app.py                      # FastAPI 主入口
│   ├── config.py                   # 配置管理（API Key 等）
│   ├── routes/
│   │   ├── chat.py                 # 对话路由 (/api/chat)
│   │   └── history.py              # 历史记录路由
│   ├── services/
│   │   └── coze_client.py          # Coze API 封装（流式转发）
│   ├── models/
│   │   └── schemas.py              # 请求/响应数据模型
│   ├── requirements.txt            # Python 依赖
│   └── .env                        # 环境变量（不提交 Git）
│
├── frontend/                       # 前端页面
│   ├── index.html                  # 单页应用入口
│   ├── css/
│   │   ├── variables.css            # 设计令牌
│   │   ├── base.css                # 基础样式 & reset
│   │   ├── components.css          # 组件样式
│   │   └── layout.css              # 布局样式
│   ├── js/
│   │   ├── app.js                  # 主控制器
│   │   ├── api.js                  # 后端请求封装
│   │   ├── chat.js                 # 聊天引擎
│   │   ├── renderer.js             # 内容渲染器
│   │   ├── history.js              # 历史记录管理
│   │   └── ui.js                   # UI 交互控制
│   └── assets/
│       ├── icons/                  # SVG 图标
│       └── images/                 # 品牌素材
│
└── tests/                          # 测试（可选）
    └── test_api.py                 # API 接口测试
```

---

## 快速开始

### 前置条件

1. **Python 3.10+** 已安装
2. **Node.js 18+**（如需前端开发服务器）
3. **Coze 账号**并完成以下准备：
   - 创建 Bot（智能体）并获取 **Bot ID**
   - 获取 **Personal Access Token (PAT)**
   - 在知识库中上传课程资料文档

### 1. 克隆 / 进入项目

```bash
cd E:/AI课代表
```

### 2. 配置后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate   # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境变量

在 `backend/.env` 文件中填入你的 Coze 凭据：

```env
# Coze API 配置
COZE_API_KEY=pat_xxxxxxxxxxxxxxxxxxxx
COZE_BOT_ID=bot_xxxxxxxxxxxxxxxxxxxx

# 服务配置
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
HOST=0.0.0.0
PORT=8000
```

> ⚠️ `.env` 文件包含敏感信息，请勿提交到 Git 仓库。

### 4. 启动后端服务

```bash
cd backend
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

后端启动成功后：
- API 文档：`http://localhost:8000/docs`（Swagger UI）
- 对话接口：`POST http://localhost:8000/api/chat`

### 5. 启动前端

**方式一：直接打开 HTML 文件**
```bash
# 直接在浏览器中打开
frontend/index.html
```

> 注意：直接打开可能遇到跨域问题，推荐使用方式二。

**方式二：使用本地静态服务器**
```bash
# 使用 Python
cd frontend
python -m http.server 5500

# 或使用 Node.js npx
npx serve frontend -l 5500
```

然后访问 `http://localhost:5500`

### 6. 开始使用

1. 浏览器打开 `http://localhost:5500`
2. 输入你的第一个问题，例如："数据库的三大范式是什么？"
3. 体验四步伴学工作流！

---

## API 接口说明

### POST /api/chat

发送消息并获取 AI 流式回复。

**请求：**
```json
{
  "message": "数据库的范式有哪些？",
  "conversation_id": "可选-会话ID，首次可不传",
  "user_id": "user_123"
}
```

**响应：** SSE 流式事件流

| 事件类型 | 说明 |
|----------|------|
| `message` | AI 回复文本片段（增量） |
| `citation` | 引用来源信息 |
| `practice` | 练习题卡片数据 |
| `done` | 流结束标记 |
| `error` | 错误信息 |

---

## 开发计划

| 阶段 | 内容 | 状态 |
|------|------|:----:|
| P0 | PRD 评审 + 静态原型 | ✅ 进行中 |
| P1 | 后端 FastAPI + Coze API 打通 | ⬜ |
| P2 | SSE 流式渲染 + Markdown/公式支持 | ⬜ |
| P3 | 四步伴学工作流 + 练习交互 + 引用卡片 | ⬜ |
| P4 | 历史记录 + 主题切换 + 响应式 + 完善打磨 | ⬜ |

---

## 架构设计

```
┌─────────────┐      HTTP/SSE        ┌──────────────┐     REST API      ┌──────────┐
│             │ ◄──────────────────► │              │ ◄──────────────► │          │
│  Frontend   │                      │  Backend     │                  │   Coze   │
│  (浏览器)    │                      │  (FastAPI)   │                  │   API    │
│             │                      │              │                  │          │
└─────────────┘                      └──────────────┘                  └──────────┘
                                              │
                                         .env 配置
                                    (API Key / Bot ID)
```

**核心设计原则：**
- **API Key 安全**：Key 仅存后端 `.env`，前端不可见
- **松耦合**：前端不直接依赖 Coze，可替换任意 LLM 后端
- **流式体验**：SSE 全链路流式传输，首字延迟 < 500ms
- **零构建**：前端原生开发，无 webpack/vite 等工具链

---

## 许可证

MIT License

---

## 相关链接

- [Coze 开放平台文档](https://www.coze.cn/docs/develop_guide/coze_api_overview)
- [PRD 产品需求文档](./PRD.md)
