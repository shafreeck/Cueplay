# 一起看电影项目：技术栈选型（v0）

## 0. 选型目标与约束

**核心目标**
- 播放体验第一：优先支持桌面端/移动端原生直连夸克播放（可携带完整 Cookie）。
- 同步体验第二：房间内播放进度、播放状态、媒体切换一致且可控。
- 工程效率：前后端 TypeScript 统一；本地可部署；迭代快。

**关键约束**
- 夸克播放链路需要完整 Cookie（共享不可避免），因此必须做“租约 + 物理撤销（登出）”两层治理。
- Web 端受浏览器安全模型限制（Cookie/跨域），纯 Web 端直连夸克不作为第一阶段目标。


---

## 1. 总体架构与技术栈概览

### 1.1 客户端（桌面端优先）
- **Tauri（Desktop App）**
  - 作用：原生壳 + 本地能力（安全存储、网络请求、可选本地代理）
  - 优势：体积小、性能好、可复用 Web UI、可接入系统 Keychain/Credential Store
  - UI 层：Next.js 前端作为 Tauri WebView 渲染目标（或静态构建产物）

- **Next.js（UI & Web 层）**
  - 作用：统一 UI 技术栈；桌面端 UI 与未来 Web 端共用组件/页面逻辑
  - 建议：App Router + TypeScript + React Server Components（谨慎使用，避免在桌面端受限）
  - CSS：Tailwind CSS

> 说明：第一阶段即便“不做纯 Web 播放”，Next.js 依然是桌面端 UI 的最佳载体。


### 1.2 服务端（控制面优先，数据面可选）
- **Fastify（Node.js / TypeScript）**
  - 作用：房间/同步/租约/审计等控制面 API；WebSocket 同步通道
  - 选择理由：高性能、插件生态成熟、适合流式转发（未来 Web 代理时可复用）

- **SQLite（数据库）**
  - 作用：房间、成员、设备、租约、审计日志、服务配置等持久化
  - 选择理由：零运维、本地部署友好；可通过 WAL 提升并发读写体验
  - 访问层：Kysely / Drizzle / Prisma（建议 Kysely 或 Drizzle，轻量且 TS 友好）

- **WebSocket（同步通道）**
  - 推荐：`@fastify/websocket` 或 Socket.IO（若需要更强的重连/房间广播能力）
  - 用途：播放状态同步、控制指令、租约授予/撤销事件、房间成员事件


---

## 2. 关键子系统选型

### 2.1 夸克播放接入（端侧优先）
- **Tauri Sidecar / Rust 插件（可选，但建议预留）**
  - 用途：
    - 处理夸克 Cookie/Headers 注入与请求构造（避免 JS 层泄露）
    - 可选：本地 HTTP 代理（桌面端播放器更稳定，且可复用 Range/重定向处理逻辑）
  - 网络库：
    - Rust：reqwest / hyper（更可控）
    - 或 Tauri JS：fetch/axios（但要严格控制日志与泄露面）

- **播放器**
  - 桌面端优先使用浏览器 `<video>`（MP4 Range 支持良好）
  - 若遇到格式/音轨/字幕兼容问题：引入 mpv（通过 sidecar）作为高兼容播放后备方案


### 2.2 安全存储（必须）
- **Cookie / 凭证存储**
  - macOS：Keychain
  - Windows：Credential Manager
  - Linux：libsecret/gnome-keyring
  - Tauri：建议使用系统 Keychain 的封装库（或自建 Rust 访问层）
- **目的**：Cookie 在端侧安全落地；避免明文文件、避免控制台日志、避免 crash dump 泄露


### 2.3 E2E 加密通道（授权分发必须）
用于“租约发放时分发 Cookie（密文）”
- 密钥协商：X25519（ECDH）
- 对称加密：AES-256-GCM 或 ChaCha20-Poly1305
- 实现库：
  - Web/Node：`tweetnacl` / `libsodium`（任选其一）
- 原则：服务端只转发密文，不持有明文 Cookie（除非进入“服务端代理”模式）


### 2.4 观影同步算法（控制面 + 端侧）
- 同步模型：Leader（房主）权威时间线 + 周期性 state 广播 + 漂移修正
- 端侧策略：
  - 小漂移：轻微调 playbackRate
  - 大漂移：seek 对齐
- 目的：弱网/抖动下仍保持稳定同步体验


---

## 3. 可选技术栈（第二阶段能力预留）

### 3.1 纯 Web 端播放（非第一阶段）
- 浏览器插件（Chrome/Edge Extension）
  - 用途：在浏览器侧获得夸克域 Cookie 权限，实现直连播放（可选）
- 服务端代理（VPS / 你自有节点）
  - 用途：Web 端无法直连时，通过你的代理携带 Cookie 拉取夸克媒体流（Range 转发）
  - 技术延续：仍用 Fastify（流式转发 + 限流 + 小缓存）

> 结论：Web 端是“后续扩展”，不阻塞原生端 MVP。


---

## 4. 开发与工程化工具链

- 语言：TypeScript（前后端一致）、Rust（Tauri 插件/sidecar 可选）
- 包管理：pnpm（推荐）
- Monorepo：Turborepo 或 Nx（推荐 Turborepo，轻量）
- 代码规范：ESLint + Prettier + TypeScript strict
- 接口契约：
  - OpenAPI（REST） + Zod（运行时校验）
  - 或 tRPC（若希望端到端类型一致；但 WS/事件模型仍需自定义）
- 部署：
  - 控制面：Docker（Fastify + SQLite 挂载卷）
  - 桌面端：Tauri 打包（macOS/Windows/Linux）


---

## 5. 选型结论（摘要）

**核心栈**
- Desktop：**Tauri + Next.js**
- Server（控制面）：**Fastify + WebSocket**
- DB：**SQLite（WAL）**
- 安全：**系统安全存储 + E2E 加密分发（Cookie）**

**扩展栈（后续）**
- Web：浏览器插件 / 服务端代理（Fastify 复用流式转发能力）
- 播放器后备：mpv sidecar（提升格式兼容与稳定性）

---