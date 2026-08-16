# 基于 Node.js 官方镜像构建
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

# 复制源码并构建前端
COPY frontend ./frontend
COPY backend ./backend
RUN cd frontend && npm run build

# 运行镜像：Nginx + Node 后端 + PM2
FROM node:22-alpine

RUN apk add --no-cache nginx && npm install -g pm2

WORKDIR /app

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/ecosystem.config.cjs ./ecosystem.config.cjs

RUN mkdir -p /app/backend/data/clips /app/backend/data/uploads

ENV NODE_ENV=production

EXPOSE 80

CMD ["sh", "-c", "nginx && pm2-runtime /app/ecosystem.config.cjs"]
