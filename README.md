# Web Clipper 网页剪藏工具

一个自托管的网页剪藏与个人知识管理工具：把网页正文、图片完整保存到本地，并通过检索、标签、笔记本、AI 摘要与知识库问答，把碎片信息沉淀为可检索的知识资产。

## 项目介绍

Web Clipper 面向希望数据自持、不把剪藏内容交给第三方云服务的个人用户与小型团队。它由浏览器扩展、Web 前端与 Node.js 后端三部分组成，所有内容以 JSON 文件与本地图片的形式存储在你自己掌控的服务器或电脑上。

**核心亮点**

- 剪藏完整：正文、作者、封面与正文图片一并保存，图片自动下载到本地，原站失效也不影响阅读
- 抓取可靠：针对 CSDN、掘金、微信公众号、知乎、小红书等 18+ 站点做专项适配，结合 JSON-LD 与 Readability 解析常规博客；反爬或懒加载站点可改用浏览器扩展读取已加载页面
- 知识沉淀：全文检索、标签与二级笔记本、回收站、Markdown/PDF 导出、RSS 输出
- AI 增强：自动摘要、智能标签、基于知识库的多轮问答（RAG，支持流式输出），未配置 LLM Key 时自动降级
- 数据自持：JSON 文件加本地图片存储，整个数据目录可直接备份与迁移
- 部署灵活：Docker、Nginx、单端口、静态托管、Windows 一键脚本等多种方式

**项目状态**：功能可自用、可部署，仍在持续迭代，规划见「开源计划」。

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

### 交互与可用性
- 统一导航：剪藏详情页保留侧边栏与移动端导航；移动端底部 Tab 增加「更多」入口，覆盖知识库、智能问答、草稿箱、统计、回收站、分享管理与设置全部页面，并修正菜单高亮
- 操作逻辑：草稿箱「继续编辑」复用原草稿（不再产生重复草稿）、编辑任一字段自动存本地草稿；分享对话框读取已有分享，关闭分享不再新建记录；未知路由自动回到剪藏列表
- 编辑保护：编辑抽屉存在未保存修改时，点击取消、关闭图标或遮罩会二次确认，避免误丢内容
- 反馈与一致性：列表页加载失败统一提示；日期时间格式全站统一（`utils/date.js`）；统计与知识库空值兜底，避免图表异常

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
PUBLIC_BASE_URL=https://your-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
```

`PUBLIC_BASE_URL` 用于生成分享链接与 RSS；`CORS_ORIGIN` 默认 `*` 放行全部，前后端分离部署时建议收紧为前端域名（多个用英文逗号分隔）。

## 部署方式

项目支持多种部署方式，按需选择。点击各方式标题可展开详细步骤。

| 方式 | 适用场景 | 主要入口 |
|------|----------|----------|
| [一、Docker](#方式一docker推荐) | 服务器长期运行，一键编排 | `deploy/Dockerfile`、`deploy/docker-compose.yml` |
| [二、传统服务器](#方式二传统服务器nginx--pm2--systemd) | Nginx + PM2 / systemd | `deploy/nginx.conf`、`deploy/ecosystem.config.cjs`、`deploy/web-clipper.service` |
| [三、单端口运行](#方式三单端口运行后端托管前端) | 无需 Nginx，后端托管前端 | `SERVE_DIST=true` |
| [四、静态托管 + 独立后端](#方式四静态托管--独立后端cloudflare--netlify--vercel) | Cloudflare Pages / Workers / Netlify / Vercel / Render | `wrangler.toml`、`wrangler.workers.toml`、`netlify.toml`、`vercel.json`、`render.yaml` |
| [五、Windows 一键部署](#方式五windows-一键部署本地测试) | 本地测试 | `deploy/windows/一键部署.cmd`、`一键部署.bat` |
| [六、PWA / 浏览器扩展](#方式六pwa-与浏览器扩展) | 桌面安装、反爬站点剪藏 | `frontend/public/`、`extension/` |

### 方式一：Docker（推荐）

<details>
<summary>展开：Docker 部署步骤</summary>

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

</details>

### 方式二：传统服务器（Nginx + PM2 / systemd）

<details>
<summary>展开：传统服务器部署步骤</summary>

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

</details>

### 方式三：单端口运行（后端托管前端）

<details>
<summary>展开：单端口部署步骤</summary>

无需 Nginx，后端同时提供静态页面与接口：

```bash
npm --prefix frontend ci && npm --prefix frontend run build
npm --prefix backend ci --omit=dev
SERVE_DIST=true PORT=3001 node backend/src/server.js
```

</details>

### 方式四：静态托管 + 独立后端（Cloudflare / Netlify / Vercel）

<details>
<summary>展开：静态托管部署步骤</summary>

前端为纯静态产物，可托管在任意静态平台，后端单独部署。

#### 4.1 通用：跨域直连

跨域时通过构建期环境变量指定后端地址（参考 `frontend/.env.example`）：

```bash
VITE_API_BASE=https://api.example.com/api
VITE_ASSET_BASE=https://api.example.com
```

#### 4.2 Cloudflare（Workers 或 Pages，任选其一）

Cloudflare 现推荐新项目优先使用 **Workers（Static Assets）**。仓库同时内置两套边缘代理配置，都会在边缘把 `/api`、`/rss`、`/uploads` 反向代理到后端，前后端在浏览器看来同源，正文图片无需改写。

**方案 A：Cloudflare Workers（推荐）** — `wrangler.workers.toml` + `workers/index.js`

```bash
# 安装并登录 Wrangler
npm install -g wrangler@latest
wrangler login

# 构建前端（产物 frontend/dist）
npm --prefix frontend ci && npm --prefix frontend run build

# 配置后端地址（加密 Secret）
wrangler secret put API_ORIGIN --config wrangler.workers.toml

# 本地预览（http://localhost:8787）
wrangler dev --config wrangler.workers.toml

# 部署
wrangler deploy --config wrangler.workers.toml
```

**方案 B：Cloudflare Pages + Functions** — `wrangler.toml` + `functions/[[path]].js`

```bash
# Dashboard 连接 Git 时填写：
#   构建命令：npm --prefix frontend ci && npm --prefix frontend run build
#   输出目录：frontend/dist
#   环境变量：API_ORIGIN=https://your-backend-domain

# 或用 CLI 手动部署
npm --prefix frontend ci && npm --prefix frontend run build
wrangler pages project create web-clipper --production-branch main
wrangler pages dev                                  # 本地预览
wrangler pages deploy                               # 部署
wrangler pages secret put API_ORIGIN --project-name web-clipper  # 配置后端地址
```

- Pages 与 Workers 共用 `shared/cloudflareProxy.js` 的转发逻辑
- `frontend/public/_routes.json` 把 Pages Functions 的调用范围收敛到 `/api`、`/rss`、`/uploads`，静态资源与 SPA 路由不触发函数
- `wrangler.workers.toml` 的 `run_worker_first` 保证 `/api`、`/rss`、`/uploads` 始终先经过 Worker（RSS 是导航请求，默认会被 SPA 回退拦截）
- 根目录 `.node-version` 固定构建 Node 为 22

完整的构建命令、部署命令、预览命令、路径与排错见 `docs/cloudflare-deploy.md`。

#### 4.3 Render

仓库根目录 `render.yaml` 提供 Blueprint，一键构建并启动单服务。

#### 4.4 Netlify / Vercel

后端已启用 CORS，直接配置构建期变量即可跨域访问后端，无需代理函数：

- Netlify：`netlify.toml` 已配置构建命令与输出目录；在站点环境变量中设置 `VITE_API_BASE`、`VITE_ASSET_BASE`
- Vercel：`vercel.json` 已配置构建命令、输出目录与 SPA 回退；在项目环境变量中设置 `VITE_API_BASE`、`VITE_ASSET_BASE`

</details>

### 方式五：Windows 一键部署（本地测试）

<details>
<summary>展开：Windows 一键部署步骤</summary>

面向 Windows 本地测试，脚本自动安装 Node.js、安装依赖、启动服务并打开浏览器。提供两种入口：

- `deploy/windows/一键部署.cmd`：纯批处理版，双击即用，无需 PowerShell。检测到 Node.js 缺失或版本过低时用 winget 安装 LTS，随后安装依赖并启动前后端（`http://localhost:5173`）
- `deploy/windows/一键部署.bat` + `install.ps1`：完整版，功能更全
  - 默认：开发模式启动，前后端热更新
  - `-Prod`：构建前端并以单端口方式启动（`http://localhost:3001`）
  - `-InstallOnly`：仅安装环境与依赖，不启动服务

```powershell
# 完整版生产模式
powershell -ExecutionPolicy Bypass -File .\deploy\windows\install.ps1 -Prod
```

要求 Windows 10 及以上。未检测到 Node.js 时优先用 winget 安装 LTS；PowerShell 完整版在无 winget 时会回退下载官方 MSI 静默安装，依赖安装失败时会提示切换 npm 镜像。

</details>

### 方式六：PWA 与浏览器扩展

<details>
<summary>展开：PWA 与扩展说明</summary>

- **PWA 安装**：内置 Service Worker 与 Web App Manifest，支持离线访问与桌面安装
- **Chrome 扩展**：`extension/` 目录加载未打包扩展，点击工具栏图标一键剪藏当前页面。扩展内置共享快照引擎（`extension/snapshot.js`），支持懒加载站点自动滚动加载全文后保存（适合小红书/什么值得买等反爬或懒加载页面）；右键菜单提供「保存选区 / 保存整页 / 滚动加载全文后保存」；对微信公众号、知乎等主流平台自动提取作者与正文容器

</details>

### 备份、健康检查与 HTTPS

<details>
<summary>展开：备份与 HTTPS 步骤</summary>

```bash
# 数据备份（JSON 数据 + 本地化图片）
DATA_DIR=backend/data BACKUP_DIR=./backups ./deploy/backup.sh

# 部署后健康检查
BASE_URL=http://localhost ./deploy/verify.sh
```

Docker 数据卷场景的备份命令见 `deploy/backup.sh` 顶部注释；恢复时停止服务后解压覆盖数据目录再启动。

需要 HTTPS 时，用 `deploy/nginx.https.conf` 替代 `deploy/nginx.conf`（二选一，避免 upstream 重名），按注释挂载证书与修改域名；证书可用 Certbot 申请。

</details>

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
│   │   ├── layouts/  # 布局（侧边栏 / 移动端导航）
│   │   ├── router/   # 路由
│   │   ├── stores/   # Pinia 状态
│   │   ├── utils/    # 通用工具（日期格式化等）
│   │   └── api/      # Axios 封装
│   └── public/       # PWA 配置与静态托管文件（_redirects/_headers/_routes.json）
├── extension/        # Chrome 扩展
├── deploy/           # Docker / Nginx / PM2 / systemd 配置
│   └── windows/      # Windows 一键部署脚本
├── functions/        # Cloudflare Pages 边缘代理函数
├── workers/          # Cloudflare Workers 边缘代理入口
├── shared/           # Cloudflare 代理共享逻辑（Pages Functions 与 Workers 共用）
├── docs/             # 部署等专项文档（如 docs/cloudflare-deploy.md）
├── scripts/          # 工具脚本
├── .node-version     # 构建 Node 版本（静态托管平台自动读取）
└── LICENSE           # MIT 许可证
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

## 开源计划

本项目坚持「数据自持 + 可自托管」的定位，以 MIT 许可证开放源代码。

### 版本规划

| 能力 | 内容 | 状态 |
|------|------|------|
| 基础剪藏 | 内容保存、检索、标签、笔记本、批注、分享链接、RSS | 已完成 |
| AI 赋能 | 自动摘要、智能标签、Telegram / 邮件推送（需自备 Key） | 已完成 |
| 知识管理 | Markdown 标准化、Markdown / PDF / ZIP 导出、全库检索、RAG 问答 | 已完成 |
| 浏览器扩展 | 共享快照引擎、右键三档剪藏、主流平台 DOM 提取 | 已完成 |
| 部署体系 | Docker / Nginx / 单端口 / 静态托管 / Windows 一键脚本 | 已完成 |
| 全文 OCR | 图片与扫描件文字识别并纳入检索 | 计划中 |
| 网页存档 | 保存整页快照并支持离线回放 | 计划中 |
| 书签同步 | 导入浏览器书签并批量整理 | 计划中 |
| 协作笔记 | 多人共享笔记本与权限控制 | 计划中 |
| 全文翻译 | 剪藏正文多语言翻译 | 计划中 |

阶段规划会随反馈调整，已完成能力以实际代码为准。

### 参与贡献

- 通过 Issue 反馈 Bug 或需求，建议附上复现步骤、期望结果与截图
- 提交 PR 前请在本地跑通：前端 `npm --prefix frontend run build`、后端 `npm --prefix backend start`
- 改动尽量聚焦单一问题，保持与现有代码风格和目录约定一致
- 新增站点抓取适配时，请同时更新后端 `backend/src/services/extractService.js` 与扩展 `extension/snapshot.js` 的规则表

### 免责声明

本项目仅用于个人学习与自用剪藏。请遵守目标网站的 robots 协议、服务条款与版权规定，不得用于批量抓取、商业转载或任何侵权用途。使用本项目产生的任何后果由使用者自行承担。

## 许可证

本项目基于 [MIT License](./LICENSE) 开源，可自由使用、修改与分发，请保留版权声明。
