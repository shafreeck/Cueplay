# Cueplay

[简体中文](./README_zh.md)

Cueplay is a modern, cross-platform collaborative media playback application. It enables users to watch video content in sync, creating a shared viewing experience across different devices.

Cueplay is built with a high-performance stack, combining the security and speed of Rust (via Tauri) with the flexibility of a modern web frontend (Next.js).

## ✨ Features

-   **Synchronized Playback**: Leveraging advanced synchronization protocols to ensure all users in a room see the same frame at the same time.
-   **Cross-Platform**: Native desktop experience on macOS, Windows, and Linux powered by [Tauri v2](https://v2.tauri.app/).
-   **High Performance**: Minimal resource usage thanks to the Rust backend and lightweight webview architecture.
-   **Modern UI**: A beautiful, dark-themed interface built with **Next.js**, **Tailwind CSS**, and **shadcn/ui**.
-   **Real-time Collaboration**: WebSocket-based communication for instant updates and interaction.
-   **Auto-Update**: Built-in mechanisms to keep your application up-to-date automatically.

## 📥 Download

You can download the latest pre-compiled binaries for macOS, Windows, and Linux from the [Releases Page](https://github.com/shafreeck/Cueplay/releases).

**Ready to Play**: The client comes pre-configured to connect to our official server. Simply download, install, and start watching together immediately!

## 🛠 Tech Stack

-   **Frontend**: React 19, Next.js 14, Tailwind CSS, Radix UI.
-   **Desktop Engine**: Tauri v2 (Rust).
-   **Backend Service**: Fastify, WebSocket, Prisma.
-   **Core Logic**: Modularized packages for Room management, Playback syncing, and Leasing (`@cueplay/room-core`, etc.).

## 🚀 Usage

This project is organized as a pnpm workspace.

### Prerequisites

-   **Node.js**: v20 or higher.
-   **pnpm**: Package manager.
-   **Rust**: Required for building the desktop application foundation.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/shafreeck/Cueplay.git
cd Cueplay
pnpm install
```

### 🖥️ Client (Desktop App)

The desktop client is located in `apps/desktop`. To run it in development mode:

```bash
# Start the Next.js frontend and Tauri dev window
pnpm --filter=@cueplay/desktop desktop
```

This command will:
1.  Start the Next.js dev server (default port 3001).
2.  Launch the Tauri application window.

### ⚙️ Server (API)

The backend API service is located in `services/api`. It handles room logic and signaling.

```bash
# Start the API server in watch mode
pnpm --filter=@cueplay/api dev
```

If you need to set up the database (Prisma):

```bash
# Migrate database
pnpm --filter=@cueplay/api db:migrate
```
