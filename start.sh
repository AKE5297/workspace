#!/bin/bash
# 本地开发启动脚本：同时启动后端与前端
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# 检查依赖
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "[setup] 安装后端依赖..."
  (cd "$ROOT/backend" && npm install)
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "[setup] 安装前端依赖..."
  (cd "$ROOT/frontend" && npm install)
fi

# 复制环境变量模板（如不存在）
if [ ! -f "$ROOT/backend/.env" ] && [ -f "$ROOT/backend/.env.example" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "[setup] 已生成 backend/.env，请按需修改配置"
fi

cleanup() {
  echo "[cleanup] 停止所有服务..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT

echo "[start] 启动后端 (http://localhost:3001)"
(cd "$ROOT/backend" && npm run dev) &
BACKEND_PID=$!

echo "[start] 启动前端 (http://localhost:5173)"
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

wait
