# Cueplay (中文)

[English](./README.md)

Cueplay 是一个现代化的跨平台协同媒体播放应用。它允许用户同步观看视频内容，打破空间限制，提供流畅的“一起看”体验。

Cueplay 采用了高性能的技术栈，结合了 Rust (Tauri) 的安全与速度，以及现代 Web 前端 (Next.js) 的灵活性。

## ✨ 功能特性

-   **同步播放**：利用先进的同步协议，确保房间内的所有用户在同一时刻看到相同的画面。
-   **跨平台支持**：基于 [Tauri v2](https://v2.tauri.app/) 构建，提供 macOS, Windows 和 Linux 的原生体验。
-   **高性能**：得益于 Rust 后端和轻量级 Webview 架构，系统资源占用极低。
-   **现代 UI**：使用 **Next.js**, **Tailwind CSS** 和 **shadcn/ui** 打造的精美暗色系界面。
-   **实时协作**：基于 WebSocket 通信，实现毫秒级状态同步。
-   **自动更新**：内置自动更新机制，确保应用始终保持最新版本。

## 📥 下载

您可以从 [Releases 页面](https://github.com/shafreeck/Cueplay/releases) 下载适用于 macOS, Windows 和 Linux 的最新预编译版本。

**开箱即用**：客户端已预置官方服务地址，安装后即可直接连接使用，无需繁琐配置，立即开启同步观看体验。

## 🛠 技术栈

-   **前端**: React 19, Next.js 14, Tailwind CSS, Radix UI.
-   **桌面引擎**: Tauri v2 (Rust).
-   **后端服务**: Fastify, WebSocket, Prisma.
-   **核心逻辑**: 模块化的核心包 (`@cueplay/room-core`, `@cueplay/sync-core` 等).

## 🚀 使用指南

本项目采用 pnpm workspace 进行管理。

### 前置要求

-   **Node.js**: v20 或更高版本.
-   **pnpm**: 包管理器.
-   **Rust**: 用于构建桌面端底层环境.

### 安装

克隆仓库并安装依赖：

```bash
git clone https://github.com/shafreeck/Cueplay.git
cd Cueplay
pnpm install
```

### 🖥️ 客户端 (桌面应用)

桌面端代码位于 `apps/desktop`。在开发模式下启动：

```bash
# 启动 Next.js 前端和 Tauri 开发窗口
pnpm --filter=@cueplay/desktop desktop
```

该命令将会：
1.  启动 Next.js 开发服务器 (默认端口 3001)。
2.  启动 Tauri 应用窗口。

### ⚙️ 服务端 (API)

后端 API 服务位于 `services/api`。它负责处理房间逻辑和信令交换。

```bash
# 以监听模式启动 API 服务器
pnpm --filter=@cueplay/api dev
```

如果需要初始化数据库 (Prisma)：

```bash
# 迁移数据库
pnpm --filter=@cueplay/api db:migrate
```
