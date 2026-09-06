# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-08-18
- Context: 网页剪藏功能开发过程中，用户明确要求统一前端访问方式
- Instructions:
  - 前端只通过 5173 端口访问（Vite dev server 代理 /api、/rss、/uploads），3001 后端不托管网页，仅提供 API

[Project Knowledge Summary]
- Date: 2026-08-18
- Context: Discovered by Agent while testing 知乎/什么值得买等文章平台抓取方案
- Category: Environment Configuration
- Instructions:
  - 本 devbox 内存紧张（可用约 200MB），无法运行 Chromium 等无头浏览器，playwright/puppeteer 方案不可行
  - 知乎（403 zse_ck 签名）、什么值得买（202 腾讯 WAF）、掘金（字节 WAFJS）等反爬站点纯 HTTP 抓取无解
  - 反爬站点抓取方案：使用 extension/ 浏览器扩展读取已加载页面 DOM（capturePage 已抓 content + images）
  - extractService 已内置 WAF 挑战页识别，失败时返回"请在浏览器中打开后使用扩展剪藏"提示
  - extractService 有 SITE_ADAPTERS 站点专项表（CSDN/博客园/简书/掘金/IT之家/少数派/阮一峰/微信）+ JSON-LD 解析兜底，新增平台抓取适配应扩展该表
  - 简书等 SPA 站点正文纯 JS 渲染，服务端只能拿到摘要，完整正文需扩展剪藏
  - 后端 JSON 文件存储于 backend/data/，测试后需清理数据（测试账号/剪藏）

[Project Knowledge Summary]
- Date: 2026-08-18
- Context: Discovered by Agent while adding snapshot engine to extension (第二轮剪藏增强)
- Category: Workflow & Collaboration
- Instructions:
  - 站点剪藏规则需同时维护两处：后端 backend/src/services/extractService.js 的 SITE_ADAPTERS（URL 抓取）+ 扩展 extension/snapshot.js 的 SITE_RULES（DOM 抓取），两者结构与选择器应保持一致
  - extension/snapshot.js 是 popup/background 共享的页面抓取引擎，CAPTURE_FN 会被 executeScript 序列化注入，函数体必须自包含（host/titleClean 用正则源字符串，不能传 RegExp 对象，args 序列化会破坏 RegExp）
  - 扩展右键菜单现分三档：保存选区 / 保存整页（fast 直接抓）/ 滚动加载全文后保存（full 自动滚到底触发懒加载+展开全文）
  - 小红书(explore|discovery/item)、什么值得买(smzdm.com/p) 后端 HTTP 抓不到，只能走扩展 full 模式 DOM 剪藏
