cueplay/
├── apps/                         # 可运行应用（端）
│   ├── desktop/                  # 桌面端（Tauri）
│   │   ├── src/
│   │   │   ├── main/             # Tauri Rust / native glue
│   │   │   ├── renderer/         # 前端 UI（Next.js / React）
│   │   │   └── preload/          # Native ↔ Web bridge
│   │   ├── tauri.conf.json
│   │   └── package.json
│   │
│   ├── mobile/                   # 移动端（后续，iOS / Android）
│   │   └── README.md
│   │
│   └── web/                      # Web 端（延后，兜底）
│       └── README.md
│
├── services/                     # 服务端（控制面）
│   ├── api/                      # Fastify API 服务
│   │   ├── src/
│   │   │   ├── room/             # 房间管理
│   │   │   ├── sync/             # 播放同步
│   │   │   ├── lease/            # 授权 / 租约
│   │   │   ├── admin/            # 服务管理（登出、止血）
│   │   │   ├── ws/               # WebSocket 通道
│   │   │   ├── db/               # SQLite & DAO
│   │   │   └── index.ts
│   │   ├── prisma/               # 或 raw sqlite schema
│   │   └── package.json
│   │
│   └── README.md
│
├── packages/                     # 纯模块（可复用，不可运行）
│   ├── playback-core/            # 播放核心（最重要）
│   │   ├── src/
│   │   │   ├── provider/
│   │   │   │   ├── quark/         # QuarkProvider
│   │   │   │   └── types.ts
│   │   │   ├── stream/            # Range / CDN / retry
│   │   │   ├── recovery/          # URL 失效恢复
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── sync-core/                # 同步算法（无 IO）
│   │   ├── src/
│   │   │   ├── clock.ts
│   │   │   ├── leader.ts
│   │   │   ├── follower.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── room-core/                # 房间模型（纯状态）
│   │   ├── src/
│   │   │   ├── room.ts
│   │   │   ├── member.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── lease-core/               # 授权 / 租约模型
│   │   ├── src/
│   │   │   ├── lease.ts
│   │   │   ├── policy.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── protocol/                 # 前后端共享协议
│   │   ├── src/
│   │   │   ├── events.ts          # WS 事件
│   │   │   ├── commands.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── crypto/                   # E2E 加密 / Cookie 封装
│       ├── src/
│       │   ├── encrypt.ts
│       │   ├── decrypt.ts
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── adr/
│   │   ├── 00-tech-stack.md
│   │   ├── 01-core-design.md
│   │   └── 02-modularization.md
│   └── README.md
│
├── scripts/                      # 开发脚本
│   ├── dev.sh
│   └── bootstrap.ts
│
├── package.json                  # workspace 根
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md