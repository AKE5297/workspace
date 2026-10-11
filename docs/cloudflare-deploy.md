# Cloudflare 部署指南（Workers 与 Pages）

本文档讲清如何把 Web Clipper 的前端部署到 Cloudflare，并用 **Cloudflare Workers Static Assets** 或 **Cloudflare Pages Functions** 作为边缘反向代理，把 `/api`、`/rss`、`/uploads` 转发到单独部署的后端服务。

> 现状提示：Cloudflare 官方已推荐**新项目优先使用 Workers（Static Assets）**，Pages 仍受支持且长期可用。本文两种方案都给出完整命令，可按需二选一，不要在同一域名下同时启用。

## 目录

- [一、架构与前提](#一架构与前提)
- [二、准备后端服务](#二准备后端服务)
- [三、方案 A：Cloudflare Workers（官方推荐）](#三方案-acloudflare-workers官方推荐)
- [四、方案 B：Cloudflare Pages + Functions](#四方案-bcloudflare-pages--functions)
- [五、方案 C：跨域直连（不使用代理）](#五方案-c跨域直连不使用代理)
- [六、命令速查表](#六命令速查表)
- [七、环境变量对照表](#七环境变量对照表)
- [八、缓存、升级与回滚](#八缓存升级与回滚)
- [九、排错清单](#九排错清单)

---

## 一、架构与前提

Web Clipper 由两部分组成：

- **前端**：Vue 3 + Vite 构建出的纯静态产物（`frontend/dist`），可以放在 Cloudflare。
- **后端**：Node.js + Express 服务，使用本地 JSON 文件存储（`backend/data`），**必须运行在支持 Node.js 与持久磁盘的环境**（Render、Railway、Fly.io、VPS + Docker 等）。

> 重要：本项目后端依赖 Node 文件系统（`fs`）、`jsonwebtoken`、`bcryptjs`、`multer`、`node-cron` 等 Node 专有 API，**无法直接运行在 Cloudflare Workers/Pages 的运行时**。Cloudflare 侧只承载前端静态资源与边缘代理，后端请单独部署。

三种部署形态：

| 形态 | 前端 | 后端 | 浏览器视角 | 是否需要改写正文图片 |
|------|------|------|-----------|--------------------|
| A. Workers + Worker 代理 | Cloudflare Workers | 独立域名 | 同源 | 否 |
| B. Pages + Functions 代理 | Cloudflare Pages | 独立域名 | 同源 | 否 |
| C. 跨域直连 | Cloudflare Pages/Workers | 独立域名 | 跨域 | 是（`VITE_ASSET_BASE`） |

选择建议：优先 A 或 B，浏览器只访问一个域名，跨域、Cookie、图片路径问题最少。

### 前置条件

- 已注册 Cloudflare 账号（免费套餐即可）。
- 本地 Node.js 20 及以上（用于构建与运行 Wrangler）。
- 一个已部署且可公网访问的后端地址，例如 `https://api.example.com`。
- 仓库根目录结构放对位置：
  - `wrangler.workers.toml`、`workers/index.js`：Workers 配置与入口
  - `wrangler.toml`：Pages 配置（Pages 不支持 `--config`，会读取默认的 `wrangler.toml`）
  - `functions/[[path]].js`：Pages Functions 代理
  - `shared/cloudflareProxy.js`：Pages 与 Workers 共用的代理逻辑
  - `frontend/public/_redirects`、`frontend/public/_headers`、`frontend/public/_routes.json`：SPA 回退、缓存策略与 Functions 调用范围
  - `.node-version`：固定构建 Node 版本为 22

### 工作路径约定

以下命令均在**仓库根目录**（`/workspace`）执行：

| 用途 | 路径 |
|------|------|
| 前端源码 | `frontend/` |
| 前端构建产物 | `frontend/dist/` |
| Workers 配置 | `wrangler.workers.toml` |
| Workers 入口 | `workers/index.js` |
| Pages 配置 | `wrangler.toml` |
| Pages Functions | `functions/[[path]].js` |
| 共用代理逻辑 | `shared/cloudflareProxy.js` |

---

## 二、准备后端服务

前端部署前，先把后端跑起来并得到一个 HTTPS 地址。

### 2.1 部署后端

任选一种方式（详见 README「部署方式」）：

```bash
# 单容器镜像（含前端，或仅用其 API 均可）
docker compose -f deploy/docker-compose.node.yml up -d --build
```

或使用仓库根目录的 `render.yaml` 在 Render 一键部署；或在自己的 VPS 上用 `deploy/nginx.conf` + PM2。

### 2.2 配置后端环境变量

```env
JWT_SECRET=改成一段足够长的随机字符串
PORT=3001
# 分享链接与 RSS 中生成的外链前缀，填后端对外的公网地址
PUBLIC_BASE_URL=https://api.example.com
# 使用 Workers/Pages 代理时为同源，可保持默认 * ；跨域直连时填前端域名
CORS_ORIGIN=https://your-app.workers.dev
```

### 2.3 验证后端连通

```bash
curl https://api.example.com/api/health
# 期望输出：{"ok":true,"uptime":...}
```

### 2.4 数据持久化提醒

后端数据存放在 `backend/data`（`db.json`、`clips/`、`uploads/`）。使用 PaaS 时务必挂载持久磁盘/卷，否则重新部署会丢失数据。Docker 方案已通过数据卷持久化。

---

## 三、方案 A：Cloudflare Workers（官方推荐）

Cloudflare 现已把静态资源能力整合进 Workers（**Workers Static Assets**），用一个 Worker 同时提供前端页面与反向代理。仓库已内置：

- `workers/index.js`：Worker 入口，代理 `/api`、`/rss`、`/uploads`，其余请求交给静态资源（转发逻辑复用 `shared/cloudflareProxy.js`）
- `wrangler.workers.toml`：Workers 配置（`main` + `[assets]`）

### 3.1 配置文件说明

`wrangler.workers.toml` 关键项：

```toml
name = "web-clipper"
main = "workers/index.js"
compatibility_date = "2026-10-10"   # 首次部署时改为当天日期

[assets]
directory = "./frontend/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
# 这些前缀始终先经过 Worker，保证 API 与 RSS 代理生效
run_worker_first = ["/api/*", "/rss/*", "/uploads/*"]
```

- `main`：Worker 脚本入口。
- `assets.directory`：前端构建产物目录。
- `assets.binding`：把静态资源以 `env.ASSETS` 绑定给 Worker。
- `assets.not_found_handling = "single-page-application"`：SPA 回退，未命中的路由返回 `index.html`，等价于 `_redirects` 的 `/* /index.html 200`。
- `assets.run_worker_first`：Workers 默认**静态资源优先**（先回静态文件，未命中才进 Worker）。由于 RSS 订阅地址是浏览器「导航请求」（带 `Sec-Fetch-Mode: navigate`），在未显式声明时会被 `single-page-application` 直接返回 `index.html` 而不经过 Worker，导致 RSS/API 代理失效。这里显式列出代理前缀，让这些路径始终先经过 Worker。

### 3.2 一键脚本（本地构建 + 预览 + 部署）

```bash
# 1. 安装并登录 Wrangler（建议 Wrangler v4，支持自动刷新部署令牌）
npm install -g wrangler@latest
wrangler login

# 2. 构建前端（产物输出到 frontend/dist）
npm --prefix frontend ci
npm --prefix frontend run build

# 3. 配置后端地址（二选一）
#    方式一：编辑 wrangler.workers.toml，取消 [vars] 注释并填入真实地址
#    方式二：使用命令行 Secret（推荐，避免写入仓库）
wrangler secret put API_ORIGIN --config wrangler.workers.toml
#  出现提示后粘贴 https://api.example.com 回车

# 4. 本地预览（默认 http://localhost:8787）
wrangler dev --config wrangler.workers.toml

# 5. 部署到 Cloudflare
wrangler deploy --config wrangler.workers.toml

# 6. 实时查看线上日志
wrangler tail --config wrangler.workers.toml
```

部署成功后访问 `https://web-clipper.<你的子域>.workers.dev`。

> `wrangler secret put` 将 `API_ORIGIN` 作为加密 Secret，不会出现在配置文件或 Git 中，优先级高于 `[vars]`。

### 3.3 命令逐条对照

| 步骤 | 命令 | 说明 |
|------|------|------|
| 安装 | `npm install -g wrangler@latest` | Wrangler 为 Workers 官方 CLI |
| 登录 | `wrangler login` | 浏览器授权 Cloudflare 账号 |
| 构建 | `npm --prefix frontend ci && npm --prefix frontend run build` | 产物 `frontend/dist` |
| 本地预览 | `wrangler dev --config wrangler.workers.toml` | 本地起 Worker + 静态资源 |
| 部署 | `wrangler deploy --config wrangler.workers.toml` | 上传静态资源并发布 Worker |
| 设密钥 | `wrangler secret put API_ORIGIN --config wrangler.workers.toml` | 加密注入后端地址 |
| 日志 | `wrangler tail --config wrangler.workers.toml` | 查看线上请求日志 |

### 3.4 绑定自定义域名

Workers 项目 → **Settings → Domains & Routes → Add → Custom Domain**；或使用 `wrangler.workers.toml` 的 `routes` 配置（需域名已托管在 Cloudflare）。

### 3.5 验证

```bash
curl -i https://web-clipper.<子域>.workers.dev/api/health
curl -i https://web-clipper.<子域>.workers.dev/          # 200，返回前端页面
curl -i https://web-clipper.<子域>.workers.dev/settings  # 200，SPA 回退到 index.html
```

若 `/api/health` 返回 `Missing API_ORIGIN environment variable`，说明 Secret 未配置或部署未带上，重新执行 `wrangler secret put` 后再次 `wrangler deploy`。

---

## 四、方案 B：Cloudflare Pages + Functions

此方案由两部分协作完成：

- Pages 托管前端静态文件；
- `functions/[[path]].js` 作为 Pages Functions，在边缘把 `/api`、`/rss`、`/uploads` 反向代理到后端。

### 4.1 方式一：Dashboard 连接 Git 仓库（自动构建）

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages → Create → Pages → Connect to Git**。
2. 授权并选择你的仓库（如 `AKE5297/workspace`）。
3. 在构建配置页填写（本项目前端位于 `frontend/` 子目录）：
   - **Project name**：`web-clipper`（可自定义，决定 `*.pages.dev` 子域名）
   - **Production branch**：`main`（或你的主分支）
   - **Framework preset**：`None`
   - **Build command**：
     ```
     npm --prefix frontend ci && npm --prefix frontend run build
     ```
   - **Build output directory**：
     ```
     frontend/dist
     ```
   - **Root directory**：留空（仓库根目录）
4. 展开 **Environment variables (advanced)**，添加：
   | 变量名 | 值 | 说明 |
   |--------|----|------|
   | `API_ORIGIN` | `https://api.example.com` | 后端公网地址，末尾不要带 `/` |
   | `NODE_VERSION` | 留空即可 | 可选；仓库根目录 `.node-version` 已固定为 22 |
5. 点击 **Save and Deploy**，等待首次构建完成。
6. 部署完成后访问 `https://web-clipper.pages.dev`，注册/登录即可。

> Functions 目录：Cloudflare 会自动识别仓库根目录下的 `functions/` 目录，无需额外配置。`wrangler.toml` 中已声明 `pages_build_output_dir = "frontend/dist"`。

> 调用范围优化：`frontend/public/_routes.json` 会随构建复制到 `frontend/dist`，把 Functions 的调用范围收敛到 `/api`、`/rss`、`/uploads`。静态资源与 SPA 路由不再触发函数，可显著减少调用次数、降低冷启动；未命中的前端路由由 `_redirects` 完成 SPA 回退。Pages 与 Workers 共用的转发逻辑位于 `shared/cloudflareProxy.js`。

### 4.2 方式二：使用 Wrangler CLI 手动部署

适合不想把仓库接入 Cloudflare Git、或需要本地构建后上传的场景。

```bash
# 1. 安装并登录 Wrangler
npm install -g wrangler@latest
wrangler login

# 2. 构建前端（产物输出到 frontend/dist）
npm --prefix frontend ci
npm --prefix frontend run build

# 3. 首次创建 Pages 项目
wrangler pages project create web-clipper --production-branch main

# 4. 本地预览（读取 wrangler.toml 的 pages_build_output_dir，并挂载 functions/）
wrangler pages dev

# 5. 部署 dist，同时上传 functions/
wrangler pages deploy

# 指定目录等价写法
wrangler pages deploy frontend/dist --project-name web-clipper

# 6. 发布一个预览（非生产）部署
wrangler pages deploy frontend/dist --project-name web-clipper --branch preview
```

在首次部署或 Dashboard 的 **Settings → Environment variables** 中配置 `API_ORIGIN`；也可用命令行 Secret：

```bash
wrangler pages secret put API_ORIGIN --project-name web-clipper
```

若希望用配置文件管理，可在 `wrangler.toml` 中取消注释：

```toml
[vars]
API_ORIGIN = "https://api.example.com"
```

> 注意：Pages 命令**不支持 `--config`**，会固定读取根目录 `wrangler.toml`。`[vars]` 会被打包进 Pages 项目，请勿在此写入密钥；后端密钥仍保留在后端环境。

### 4.3 命令逐条对照

| 步骤 | 命令 | 说明 |
|------|------|------|
| 安装 | `npm install -g wrangler@latest` | Wrangler 为 Pages/Workers 官方 CLI |
| 登录 | `wrangler login` | 浏览器授权 Cloudflare 账号 |
| 构建 | `npm --prefix frontend ci && npm --prefix frontend run build` | 产物 `frontend/dist` |
| 建项目 | `wrangler pages project create web-clipper --production-branch main` | 仅首次 |
| 本地预览 | `wrangler pages dev` | 读取 `wrangler.toml` 输出目录 + `functions/` |
| 部署 | `wrangler pages deploy` | 上传前端与 Functions |
| 预览部署 | `wrangler pages deploy frontend/dist --project-name web-clipper --branch preview` | 生成预览地址 |
| 设密钥 | `wrangler pages secret put API_ORIGIN --project-name web-clipper` | 加密注入后端地址 |

### 4.4 绑定自定义域名

1. Pages 项目 → **Custom domains → Set up a custom domain**。
2. 输入域名（如 `clip.example.com`），按提示添加 CNAME 记录到 `web-clipper.pages.dev`。
3. 证书由 Cloudflare 自动签发。

### 4.5 验证代理是否生效

```bash
# 通过 Pages 域名访问后端健康检查，期望 200 且返回 {"ok":true}
curl -i https://web-clipper.pages.dev/api/health

# 检查响应头是否来自后端
curl -i https://web-clipper.pages.dev/api/clips   # 未登录应为 401
```

若 `/api/health` 返回 `Missing API_ORIGIN environment variable`，说明环境变量未配置或未重新部署。

### 4.6 分支预览

连接 Git 后，向非生产分支推送会自动生成预览地址 `https://<分支名>.web-clipper.pages.dev`，方便验证。

---

## 五、方案 C：跨域直连（不使用代理）

若不想在 Cloudflare 侧维护代理，可让前端在构建期直接指向后端地址，浏览器跨域访问（后端已内置 CORS）。

### 5.1 前端构建变量

在 Pages/Workers 项目的构建环境变量中，或本地构建前设置：

```bash
VITE_API_BASE=https://api.example.com/api
VITE_ASSET_BASE=https://api.example.com
```

- `VITE_API_BASE`：所有接口请求的基地址。
- `VITE_ASSET_BASE`：用于把正文中的 `/uploads/` 图片重写到后端地址（见 `frontend/src/api/client.js` 的 `resolveAssets`）。

### 5.2 后端 CORS

```env
CORS_ORIGIN=https://web-clipper.pages.dev,https://clip.example.com
```

多个来源用英文逗号分隔；留空或 `*` 表示放行全部（仅建议本地调试）。

### 5.3 优缺点

- 优点：Cloudflare 侧无需任何函数/Worker，纯静态托管。
- 缺点：需要正确设置 `VITE_ASSET_BASE`，否则正文图片会 404；跨域请求会多一次预检（preflight）。

---

## 六、命令速查表

在仓库根目录执行：

```bash
# ===== 通用：构建前端 =====
npm --prefix frontend ci && npm --prefix frontend run build   # 产物 frontend/dist

# ===== 方案 A：Workers =====
wrangler dev --config wrangler.workers.toml            # 本地预览  http://localhost:8787
wrangler deploy --config wrangler.workers.toml         # 部署
wrangler secret put API_ORIGIN --config wrangler.workers.toml  # 配置后端地址
wrangler tail --config wrangler.workers.toml           # 查看线上日志

# ===== 方案 B：Pages =====
wrangler pages dev                                     # 本地预览（读取 wrangler.toml + functions/）
wrangler pages deploy                                  # 部署当前项目
wrangler pages deploy frontend/dist --project-name web-clipper  # 部署指定目录
wrangler pages deploy frontend/dist --project-name web-clipper --branch preview  # 预览部署
wrangler pages secret put API_ORIGIN --project-name web-clipper  # 配置后端地址
```

| 方案 | 本地预览命令 | 本地地址 | 部署命令 | 配置文件 |
|------|-------------|---------|---------|---------|
| Workers | `wrangler dev --config wrangler.workers.toml` | `http://localhost:8787` | `wrangler deploy --config wrangler.workers.toml` | `wrangler.workers.toml` |
| Pages | `wrangler pages dev` | `http://localhost:8788` | `wrangler pages deploy` | `wrangler.toml` |

---

## 七、环境变量对照表

| 位置 | 变量 | 必填 | 说明 |
|------|------|------|------|
| Workers | `API_ORIGIN` | 代理方案必填 | 后端公网地址，末尾不带 `/`；用 `wrangler secret put` 配置 |
| Pages | `API_ORIGIN` | 代理方案必填 | 同上；用 `wrangler pages secret put` 或 Dashboard 配置 |
| 构建 | `VITE_API_BASE` | 跨域直连必填 | 如 `https://api.example.com/api` |
| 构建 | `VITE_ASSET_BASE` | 跨域直连必填 | 如 `https://api.example.com` |
| 构建 | `NODE_VERSION` | 可选 | 仓库根目录 `.node-version` 已固定为 22 |
| 后端 | `JWT_SECRET` | 必填 | 生产环境务必修改 |
| 后端 | `PUBLIC_BASE_URL` | 建议 | 分享链接与 RSS 的外链前缀 |
| 后端 | `CORS_ORIGIN` | 跨域时必填 | 前端域名，逗号分隔 |
| 后端 | `USER_LLM_API_KEY` | 可选 | 启用 AI 摘要/标签/问答 |

---

## 八、缓存、升级与回滚

### 8.1 缓存策略

`frontend/public/_headers` 已声明：

- `/assets/*`：`Cache-Control: public, max-age=31536000, immutable`（Vite 产物带内容哈希，可长期缓存）
- 其他：`public, max-age=0, must-revalidate`（每次校验，避免旧版本残留）

Pages 与 Workers Static Assets 均支持资产目录下的 `_headers` 与 `_redirects` 文件。

### 8.2 升级

- Git 集成：推送代码即触发新构建；构建成功后自动切换流量。
- 手动部署：重新构建后执行 `wrangler deploy --config wrangler.workers.toml`（Workers）或 `wrangler pages deploy`（Pages）。

### 8.3 回滚

- Dashboard：Workers/Pages → **Deployments**，选择历史版本点击 **Rollback**。
- 前端为纯静态，回滚不影响后端数据。

---

## 九、排错清单

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 打开页面空白 | 构建输出目录填错 | 确认输出目录为 `frontend/dist` |
| `/api/*` 返回 500 且提示 `Missing API_ORIGIN` | 未配置环境变量 | 配置 `API_ORIGIN` 后重新部署 |
| 直接打开 `/rss/...` 返回 HTML 而非 Feed | Workers 静态资源优先，导航请求被 SPA 回退拦截 | 确认 `run_worker_first` 已包含 `/rss/*` 并重新部署 |
| 接口 401/跨域报错 | 后端 `CORS_ORIGIN` 未包含前端域名 | 更新后端 `CORS_ORIGIN` 并重启 |
| 正文图片 404 | 跨域直连未设 `VITE_ASSET_BASE` | 设置后重新构建 |
| 刷新子路由 404 | 缺少 SPA 回退 | Pages 确认 `_redirects` 已随构建输出；Workers 确认 `not_found_handling = "single-page-application"` |
| Functions 未触发 | `_routes.json` 把路径排除了 | 检查 `frontend/public/_routes.json` 的 `include` 是否覆盖 `/api`、`/rss`、`/uploads` |
| 上传大图失败 | Cloudflare 请求体大小限制 | 单次上传建议小于 100 MB |
| RAG 流式回答卡顿 | 代理缓冲 SSE | 确认代理直接透传 `text/event-stream`，不要添加缓冲头 |
| 重新部署后数据丢失 | 后端使用临时磁盘 | 后端挂载持久卷/磁盘 |
| 构建失败提示 Node 版本 | 平台默认 Node 版本过低 | 仓库根目录 `.node-version` 已固定为 22；必要时显式设置构建变量 `NODE_VERSION=22` |
| 部署报 JWT 过期 | 大型资产部署耗时超过部署令牌生命周期 | 升级到 Wrangler 4.34.0+（支持自动刷新令牌） |

---

以上任一方案部署完成后，浏览器只需访问单个 Cloudflare 域名即可使用完整功能。
