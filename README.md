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

### 知识管理阶段（Markdown / PDF / 知识库 / RAG）
- Markdown 标准化：剪藏自动生成 Markdown 正文（保留标题层级、加粗、列表、代码块、表格、图片）
- Markdown 视图：详情页一键切换原文 / Markdown 视图，支持复制
- 导出功能：单篇导出 Markdown / PDF（PDF 内置中文字体、自动分页、页眉页脚、表格与代码块排版）；列表批量导出合并 Markdown 或 ZIP 分篇（本地图片一并打包）
- 知识库整合：跨全部剪藏的聚合统计（来源站点 / 标签 / 月度趋势）+ 全库检索（关键词高亮、可按笔记本限定）
- 智能问答（RAG）：基于知识库的多轮对话问答（支持流式输出、按笔记本限定检索范围），回答附带参考来源与代码块排版；未配置 LLM Key 时前端友好提示
- 站点专项适配：CSDN / 博客园 / 简书 / 掘金 / IT之家 / 少数派 / 阮一峰 / 微信公众号 / 语雀 / GitHub / Medium / InfoQ / SegmentFault / 飞书文档 / 小红书 / 什么值得买 / 通用自建博客（WordPress / Hugo / Hexo / Typecho 等）
- 服务端智能抓取：URL 粘贴即收藏；识别 JSON-LD（Article / BlogPosting / NewsArticle 等）自动提取标题 / 作者 / 结构化正文，配合 Readability 解析任意常规博客文章，自动清理标题站点后缀与封面占位图
- 图片本地化：剪藏正文图片（含 `img`、`data-src` 懒加载图、`srcset` 响应式图、CSS `background-image` 背景图）受限并发（4 路）下载到本地并重写链接；下载优先不携带 Referer（防盗链普遍放行空 Referer），失败时按来源页 origin 或微信域名 Referer 重试，兼容微信公众号图片 CDN 防盗链

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

启动后访问 `http://localhost:5173` 即可使用全部功能，前端开发服务器会自动将 `/api`、`/rss`、`/uploads` 请求代理到后端。

后端 API 运行在 `http://localhost:3001`，**仅提供接口服务，不托管前端页面**，请统一通过 5173 端口访问网站。若需要在后端直接托管构建产物（单端口部署），可设置 `SERVE_DIST=true` 启动后端。

首次使用请先在页面注册账号。可配置的 AI 与推送功能需要修改 `backend/.env`：

```env
USER_LLM_API_KEY=your-deepseek-or-other-llm-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-chat-id
SMTP_HOST=smtp.example.com
SMTP_USER=your@email.com
SMTP_PASS=your-password
```

## 部署方式

项目支持多种部署方式，按需选择。

### 方式一：Docker（推荐）

`deploy/` 提供两套镜像与编排：

| 方案 | 文件 | 说明 | 默认端口 |
|------|------|------|----------|
| Nginx + PM2 | `deploy/Dockerfile`、`deploy/docker-compose.yml` | Nginx 提供静态文件并反向代理 API，PM2 守护后端，适合服务器长期运行 | 80 |
| 单容器 | `deploy/Dockerfile.node`、`deploy/docker-compose.node.yml` | 后端以 `SERVE_DIST=true` 同时托管前端，仅暴露一个端口，适合 PaaS | 3001 |

```bash
# 准备环境变量
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，至少修改 JWT_SECRET 与 PUBLIC_BASE_URL

# Nginx 方案
docker compose -f deploy/docker-compose.yml up -d --build

# 或单容器方案
docker compose -f deploy/docker-compose.node.yml up -d --build
```

访问 `http://localhost`（Nginx 方案）或 `http://localhost:3001`（单容器方案）。数据持久化在 `wc_data` 数据卷中。

### 方式二：传统服务器（Nginx + PM2 / systemd）

```bash
# 构建前端静态产物
npm --prefix frontend ci
npm --prefix frontend run build

# 安装后端生产依赖
npm --prefix backend ci --omit=dev

# 启动后端（PM2 守护）
cd backend && pm2 start ../deploy/ecosystem.config.cjs
```

将 `frontend/dist` 交给 Nginx 提供静态文件，并把 `/api`、`/rss`、`/uploads` 反向代理到 `http://127.0.0.1:3001`，可直接参考 `deploy/nginx.conf`（注意调整其中的 `root` 路径）。

不使用 PM2 时，可用 systemd 守护后端，模板见 `deploy/web-clipper.service`：

```bash
cp deploy/web-clipper.service /etc/systemd/system/web-clipper.service
# 修改其中的 WorkingDirectory / User / EnvironmentFile 后
systemctl daemon-reload && systemctl enable --now web-clipper
```

### 方式三：单端口运行（后端托管前端）

无需 Nginx，后端同时提供静态页面与接口：

```bash
npm --prefix frontend ci && npm --prefix frontend run build
npm --prefix backend ci --omit=dev
SERVE_DIST=true PORT=3001 node backend/src/server.js
```

### 方式四：静态托管 + 独立后端（Cloudflare Pages / Netlify / Vercel）

前端为纯静态产物，可托管在任意静态平台，后端单独部署。跨域时通过构建期环境变量指定后端地址（参考 `frontend/.env.example`）：

```bash
VITE_API_BASE=https://api.example.com/api
VITE_ASSET_BASE=https://api.example.com
```

**Cloudflare Pages**：仓库已内置 Pages 配置与代理函数

- `wrangler.toml`：`pages_build_output_dir = "frontend/dist"`
- `functions/[[path]].js`：在 Pages 边缘把 `/api`、`/rss`、`/uploads` 反向代理到后端
- `frontend/public/_redirects`：SPA 路由回退；`frontend/public/_headers`：静态资源缓存策略

在 Cloudflare Pages 项目设置中：构建命令 `npm --prefix frontend ci && npm --prefix frontend run build`，输出目录 `frontend/dist`，环境变量 `API_ORIGIN=https://your-backend-domain`。此方案下前后端在浏览器看来同源，正文图片无需改写。

**Render**：仓库根目录 `render.yaml` 提供 Blueprint，一键构建并启动单服务。

**Netlify / Vercel**：后端已启用 CORS，直接配置构建期变量即可跨域访问后端，无需代理函数

- Netlify：`netlify.toml` 已配置构建命令与输出目录；在站点环境变量中设置 `VITE_API_BASE`、`VITE_ASSET_BASE`
- Vercel：`vercel.json` 已配置构建命令、输出目录与 SPA 回退；在项目环境变量中设置 `VITE_API_BASE`、`VITE_ASSET_BASE`

### 方式五：PWA 与浏览器扩展

- **PWA 安装**：内置 Service Worker 与 Web App Manifest，支持离线访问与桌面安装
- **Chrome 扩展**：`extension/` 目录加载未打包扩展，点击工具栏图标一键剪藏当前页面。扩展内置共享快照引擎（`extension/snapshot.js`），支持懒加载站点自动滚动加载全文后保存（适合小红书/什么值得买等反爬或懒加载页面）；右键菜单提供「保存选区 / 保存整页 / 滚动加载全文后保存」；对微信公众号、知乎等主流平台自动提取作者与正文容器

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
