# Web Clipper 网页剪藏工具

一个功能完整的网页剪藏工具，支持内容保存、检索、分类管理、批注、AI 摘要、RSS 订阅、分享链接等核心功能。

## 功能特性

### 第一阶段（前端）
- 键盘快捷键：列表页 `J`/`K` 上下移动选中、`S` 收藏、`D` 删除、`E` 编辑、`Esc` 取消/关闭
- URL 重复检测：保存时自动检测相同 URL 并提示，可继续或取消
- 剪藏草稿箱：未完成保存自动存为草稿，草稿存储在浏览器 localStorage 中，不占用服务器资源
- 自定义主题色：8 套预设配色，通过 Element Plus CSS 变量全局切换
- 阅读统计：今日/本周阅读量、近 30 天趋势、标签分布、阅读时段热力图
- 剪藏分享链接：公开只读分享，支持有效期设置

### 第二阶段（核心增强）
- 深色模式：浅色 / 深色 / 跟随系统三种模式
- 移动端适配：底部 Tab 导航（首页、笔记本、标签、收藏、我的）
- 批量编辑：统一修改标题、作者、标签（追加/覆盖）、笔记本
- 回收站：删除后保留 30 天，支持单条/批量恢复与永久删除
- 二级笔记本：两级文件夹结构，缩进展示层级
- 数据可视化：剪藏趋势折线图、标签饼图、笔记本条形图、时段热力图
- RSS 输出：笔记本/标签维度导出 RSS 2.0 与 Atom Feed

### 第三阶段（AI 赋能，需配置 LLM API）
- AI 自动摘要：保存后自动生成 200 字以内摘要，失败自动重试 3 次
- AI 智能标签：根据内容语义推荐精准标签
- Telegram 推送：保存后推送到绑定频道，支持推送时段与自定义模板
- 邮件推送：SMTP 实时或每日八点汇总推送

### 第四阶段（进阶）
- 全文 OCR 识别、网页完整存档、浏览器书签同步、协作笔记本、全文翻译（预留接口，按需开发）

## 技术栈

- 前端：Vue 3 + Element Plus + Pinia + Vue Router + ECharts
- 全文检索：FlexSearch（前后端）
- 内容提取：Readability.js + jsdom
- 后端：Node.js + Express + JSON 文件存储
- 认证：JWT（bcryptjs 密码哈希）
- 图片处理：Sharp
- HTTP 客户端：Axios

## 快速开始

### 本地开发

```bash
chmod +x start.sh
./start.sh
```

启动后访问 `http://localhost:5173`，后端 API 运行在 `http://localhost:3001`。

首次使用请先在页面注册账号。可配置的 AI 与推送功能需要修改 `backend/.env`：

```env
USER_LLM_API_KEY=your-deepseek-or-other-llm-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-chat-id
SMTP_HOST=smtp.example.com
SMTP_USER=your@email.com
SMTP_PASS=your-password
```

### Docker 部署

```bash
cd deploy
docker compose up -d
```

访问 `http://localhost`。数据持久化在 `wc_data` 数据卷中。

## 部署方式

项目支持多种部署方式：

1. **Docker 容器化**：`deploy/Dockerfile` 打包前端静态文件与后端服务，Nginx 提供静态服务与反向代理，PM2 管理进程，`docker-compose.yml` 一键编排
2. **传统服务器部署**：前端 `npm run build` 产出静态文件，由 Nginx/Apache 提供；后端 `npm start` 配合 PM2 或 systemd
3. **PWA 安装**：内置 Service Worker 与 Web App Manifest，支持离线访问与桌面安装
4. **Chrome 扩展**：`extension/` 目录加载未打包扩展，点击工具栏图标一键剪藏当前页面
5. **Cloudflare Workers / Tunnel**：可参考技术栈说明将 API 与前端迁移至 Cloudflare 边缘网络

## 项目结构

```
├── backend/          # Node.js + Express 后端
│   └── src/
│       ├── routes/   # API 路由
│       ├── services/ # 业务逻辑（检索、AI、通知、回收站等）
│       └── middleware/ # JWT 认证等
├── frontend/         # Vue 3 前端
│   ├── src/
│   │   ├── views/    # 页面
│   │   ├── components/ # 组件（剪藏编辑器等）
│   │   ├── stores/   # Pinia 状态
│   │   └── api/      # Axios 封装
│   └── public/       # PWA 配置
├── extension/        # Chrome 扩展
├── deploy/           # Docker / Nginx / PM2 配置
└── scripts/          # 工具脚本
```

## 数据存储

后端使用 JSON 文件存储：

- `backend/data/db.json`：用户、剪藏索引、标签、笔记本、回收站、分享等元数据
- `backend/data/clips/*.json`：每篇剪藏的完整内容
- `backend/data/uploads/`：上传的截图与图片
- `backend/data/settings.json`：用户设置

定期备份 `backend/data/` 目录即可完成数据备份。

## 环境变量

后端所有配置项见 `backend/.env.example`，包括端口、JWT 密钥、LLM 配置、Telegram、SMTP 等。生产环境务必修改 `JWT_SECRET`。
