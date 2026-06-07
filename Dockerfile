FROM python:3.12-slim

WORKDIR /app

# 安装后端依赖
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端静态文件
COPY frontend/ ./frontend/

# 环境变量（部署时覆盖）
ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
