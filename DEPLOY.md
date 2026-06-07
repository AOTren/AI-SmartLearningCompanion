# AI 期末私教 — 云端部署指南

## 改造说明

项目已改为 **一体化部署**：FastAPI 同时托管前端静态文件和后端 API，部署只需一个服务。

核心改动：
- `backend/app.py`：新增前端静态文件托管 + SPA fallback
- `frontend/js/config.js`：API 地址自动适配（本地用 localhost，云端用相对路径）
- 新增 `Dockerfile`、`render.yaml`、`docker-compose.yml` 等部署配置

---

## 方案一：Render（推荐，免费）

Render 提供 **免费 Web Service**，适合演示和小规模使用。

### 步骤

#### 1. 把项目推到 GitHub

```bash
cd E:/AI课代表
git init
git add .
git commit -m "init: AI期末私教"

# 在 GitHub 创建仓库后
git remote add origin https://github.com/你的用户名/AI课代表.git
git push -u origin main
```

> ⚠️ 确保 `.gitignore` 包含 `.env`、`__pycache__/`、`venv/` 等，不要泄露 API Key！

#### 2. 注册 Render

访问 https://render.com 注册账号（支持 GitHub 登录）

#### 3. 创建 Web Service

1. 点击 **New → Web Service**
2. 连接你的 GitHub 仓库
3. 配置：
   - **Name**: `ai-tutor`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
4. 添加环境变量（Environment → Add Environment Variable）：
   - `COZE_API_KEY` = 你的 Coze PAT
   - `COZE_BOT_ID` = 你的 Bot ID
5. 点击 **Create Web Service**

#### 4. 等待部署完成

首次部署约 2-5 分钟。成功后你会得到一个网址：
`https://ai-tutor-xxxx.onrender.com`

直接访问即可使用！

---

## 方案二：Railway（免费额度）

Railway 提供 $5 免费额度/月，部署体验更好。

### 步骤

1. 访问 https://railway.app 注册（GitHub 登录）
2. **New Project → Deploy from GitHub repo**
3. 选择仓库后自动检测到 Dockerfile
4. 添加环境变量：
   - `COZE_API_KEY`
   - `COZE_BOT_ID`
5. 部署完成后点击生成的域名即可访问

---

## 方案三：腾讯云/阿里云轻量服务器

适合需要稳定运行、自定义域名的场景。约 50-100 元/月。

### 步骤

1. 购买轻量应用服务器（选 Ubuntu 22.04）
2. SSH 登录服务器
3. 安装 Docker：
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
4. 上传项目代码到服务器
5. 使用 Docker Compose 启动：
   ```bash
   docker compose up -d
   ```
6. 访问 `http://服务器IP:8000`

---

## 本地验证

部署前可以在本地验证一体化部署是否正常：

```bash
cd E:/AI课代表/backend
uvicorn app:app --host 0.0.0.0 --port 8000
```

然后访问 `http://localhost:8000`，应该能看到前端页面（不再需要单独启动前端服务器）。

---

## 常见问题

### Q: 部署后页面能打开但聊天不工作？
检查环境变量 `COZE_API_KEY` 和 `COZE_BOT_ID` 是否正确设置。

### Q: Render 免费版会休眠？
是的，15分钟无请求会休眠，首次唤醒约 30 秒。可以配置 UptimeRobot 定时 ping 保持唤醒。

### Q: 如何绑定自定义域名？
在 Render/Railway 的 Settings 中添加自定义域名，按提示配置 DNS 解析即可。

### Q: 部署后访问 /docs 没有 API 文档？
这是因为 SPA fallback 路由优先匹配了。直接访问 `/openapi.json` 可以获取 API Schema。
