# syntax=docker/dockerfile:1
# 多阶段构建：构建前端静态产物 + 安装后端生产依赖。
# 运行镜像：Nginx 提供静态文件与反向代理，PM2 守护 Node 后端。
FROM node:22-alpine AS builder

WORKDIR /app

# 后端生产依赖（先拷贝清单以复用缓存）
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# 前端依赖与构建
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
COPY backend ./backend
RUN cd frontend && npm run build

# ---------- 运行镜像 ----------
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx tini && npm install -g pm2

WORKDIR /app

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Alpine 的 nginx 包从 /etc/nginx/http.d/ 加载站点配置
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/ecosystem.config.cjs ./ecosystem.config.cjs

RUN mkdir -p /app/backend/data/clips /app/backend/data/uploads

ENV NODE_ENV=production

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "nginx && pm2-runtime /app/ecosystem.config.cjs"]
