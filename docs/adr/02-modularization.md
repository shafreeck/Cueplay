# CuePlay：模块划分与实现路径（ADR 02）

> 本文档在 ADR 01（核心功能方案）的约束下， 将 CuePlay 拆分为**清晰、低耦合、可渐进实现的模块体系**， 并给出**推荐的实现顺序与阶段性目标**。

---

## 0. 模块化设计原则

在 CuePlay 中，模块划分遵循以下不可违背的原则：

1. **播放优先原则**

   - 一切设计以播放体验为最高优先级
   - 播放模块不为其它模块妥协

2. **控制面与数据面严格分离**

   - 控制面：房间、同步、权限
   - 数据面：视频流（绝不进服务器）

3. **端侧自治原则**

   - 播放能力尽可能下沉到端侧
   - 服务端只做协调，不做代理（第一阶段）

4. **模块可独立演进**

   - 任一模块替换，不引发系统级重构

---

## 1. 总体模块拓扑

```
┌─────────────────────────────────────┐
│              UI Layer                │
│  Player UI / Room UI / Auth UI       │
└───────────────▲─────────────────────┘
                │
┌───────────────┴─────────────────────┐
│          Control Plane               │
│ Room / Sync / Lease / Presence      │
└───────────────▲─────────────────────┘
                │
┌───────────────┴─────────────────────┐
│          Playback Core               │
│ Provider / Stream / Recovery        │
└─────────────────────────────────────┘
```

---

## 2. 核心模块拆分

### 2.1 Playback Core（播放核心模块）

**职责**：

- 视频源解析
- CDN 播放地址管理
- Range 流播放
- 播放中断恢复

**子模块**：

- `ProviderManager`
- `QuarkProvider`
- `PlayableSource`
- `StreamController`

**关键接口示意**：

```
interface PlayableProvider {
  resolvePlayableSource(): Promise<PlayableSource>
  refreshPlayableSource(): Promise<PlayableSource>
}
```

> ⚠️ 本模块 **不允许依赖房间、同步、权限模块**。

---

### 2.2 Sync Module（播放同步模块）

**职责**：

- 时间线对齐
- 播放状态广播
- 漂移检测与修正

**子模块**：

- `SyncClock`
- `LeaderBroadcaster`
- `FollowerAdjuster`

**同步输入**：

- Leader 播放状态

**同步输出**：

- seek / rate 调整指令

---

### 2.3 Room Module（房间管理模块）

**职责**：

- 房间创建 / 销毁
- 成员加入 / 离开
- Leader 选举（初期固定为房主）

**核心实体**：

```
Room
 ├─ roomId
 ├─ ownerId
 ├─ members[]
 └─ currentMedia
```

> 房间模块 **不感知播放细节**。

---

### 2.4 Lease & Auth Module（授权与租约模块）

**职责**：

- Cookie 授权下发
- 播放租约管理
- 授权撤销

**核心概念**：

- `Lease`
  - deviceId
  - expiresAt
  - permissions

**安全边界**：

- 租约失效 ⇒ 播放必须立即停止

---

### 2.5 Service Admin Module（服务管理模块）

**职责**：

- 管理服务级夸克 Cookie
- 触发物理登出
- 安全事故止血

> 本模块 **不暴露给普通房间用户**。

---

### 2.6 UI Module（界面模块）

**职责**：

- 播放控制 UI
- 房间状态展示
- 授权确认与提示

UI 仅通过 **控制面 API** 操作系统状态。

---

## 3. 模块间依赖关系（强约束）

```
Playback Core
   ↑
Sync Module
   ↑
Room Module
   ↑
Lease & Auth Module
   ↑
Service Admin Module
```

**禁止反向依赖**：

- 播放模块不得调用同步/房间逻辑
- 同步模块不得操作 Cookie

---

## 4. 推荐实现顺序（防返工路径）

### Phase 0：基础设施

- 项目骨架（monorepo）
- 本地存储（SQLite）
- WebSocket 通道

---

### Phase 1：播放闭环（最关键）

- QuarkProvider
- CDN 播放直连
- Range 播放稳定
- URL 失效恢复

**完成标志**：

> 单机播放任意夸克视频 ≥ 1 小时无中断

---

### Phase 2：单房间同步

- Room 创建
- Leader 固定模型
- 播放/暂停/Seek 同步

**完成标志**：

> 两台设备同步看片，误差 < 500ms

---

### Phase 3：授权与租约

- Cookie 下发
- Lease 过期
- 租约撤销

**完成标志**：

> 撤销授权后 ≤ 1 秒强制停播

---

### Phase 4：稳定性与异常处理

- 网络抖动恢复
- Leader 掉线处理
- UI 状态兜底

---

## 5. 明确延期的模块

以下模块**刻意不进入第一阶段**：

- Web 端代理播放
- 插件体系
- P2P 分发
- 多房间并发优化
- 权限角色细分

---

## 6. 结束语

CuePlay 的模块化目标不是“看起来复杂”， 而是：

- 播放不被打断
- 同步不靠运气
- 安全风险可控

**先跑稳，再谈扩展。**

