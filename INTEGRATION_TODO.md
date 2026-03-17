# OpenClaw 聊天客户端 — 功能实现对比

> 最后更新：2026-03-16

## 项目结构

| 目录 | 端 | 技术栈 |
|------|---|--------|
| `src/` | Web | React 19 + TypeScript + shadcn/ui + Tailwind + Motion |
| `miniprogram/` | 微信小程序 | WXML + WXSS + 原生 JS |

---

## 协议实现

| 协议事件 | 方向 | Web | 小程序 |
|---------|------|-----|--------|
| `connection.open` | ← | ✅ | ✅ |
| `history.sync` (direction, agentId 隔离) | ← | ✅ | ✅ |
| `history.get` (按 chatId 拉历史) | → | ✅ | ❌ |
| `message.receive` (带 agentId/parentId) | → | ✅ | ✅ |
| `message.send` (带 replyTo) | ← | ✅ | ✅ |
| `thinking.start` | ← | ✅ | ✅ |
| `thinking.update` | ← | ✅ | ✅ |
| `thinking.end` | ← | ✅ | ✅ |
| `agent.list.get` → `agent.list` | ↔ | ✅ | ✅ |
| `agent.select` → `agent.selected` | ↔ | ✅ (API ready) | ✅ (API ready) |
| `conversation.list.get` → `conversation.list` | ↔ | ✅ | ❌ |
| `reaction.add` | ↔ | ✅ | ✅ |
| `reaction.remove` | ↔ | ✅ | ✅ |
| `channel.status.get` → `channel.status` | ↔ | ✅ | ✅ |
| `agentId` in WebSocket URL | → | ✅ | ✅ |
| `token` in WebSocket URL | → | ✅ | ✅ |
| Image/Voice/Audio media (`mediaUrl`) | → | ✅ | ✅ |

---

## 功能对比

### 核心聊天

| 功能 | Web | 小程序 |
|------|-----|--------|
| WebSocket 实时消息收发 | ✅ | ✅ |
| Token 认证连接 | ✅ | ✅ |
| chatId/senderId 绑定 | ✅ | ✅ |
| 历史消息加载 | ✅ | ✅ |
| 消息持久化 (localStorage) | ✅ | ✅ (wx.Storage) |
| Thinking 指示器动画 | ✅ 三点跳动 | ✅ 三点跳动 + 文字 |
| 断线自动重连 (指数退避 6次) | ✅ | ✅ |
| 消息时间显示 (HH:MM) | ✅ | ✅ |
| 日期分割线 (Today/Yesterday/日期) | ✅ | ✅ |

### 消息类型

| 功能 | Web | 小程序 |
|------|-----|--------|
| 文本消息 | ✅ | ✅ |
| Markdown 渲染 (AI 回复) | ✅ react-markdown | ✅ 自写解析器 (heading/bold/code/list/blockquote/link/hr) |
| 图片消息发送 | ✅ 选图→base64→mediaUrl | ✅ wx.chooseMedia→base64 |
| 语音消息录制发送 | ✅ MediaRecorder→webm→mediaUrl | ✅ RecorderManager→aac |

### 交互功能

| 功能 | Web | 小程序 |
|------|-----|--------|
| 斜杠命令 (13个官方命令) | ✅ 实时过滤 | ✅ 实时过滤 |
| 独立命令直接发送 | ✅ | ✅ |
| 快捷命令栏 (输入框上方) | ✅ /status /models /help /new /reset | ✅ 同上 |
| Emoji 表情发送 | ✅ 直接发送 | ✅ 空输入快速发送，有输入拼接 |
| Emoji reaction (协议) | ✅ reaction.add/remove | ✅ reaction.add/remove |
| 引用回复 (parentId) | ✅ 回复按钮 + 回复栏 + 引用块 | ✅ 回复按钮 + 回复栏 |
| AI 回复引用显示 (replyTo) | ✅ 气泡内引用块 | ✅ 气泡内引用块 |
| 交互卡片 (providers/models/think) | ✅ ActionCard 自动检测 | ✅ action-card + action-chip |

### 多 Agent

| 功能 | Web | 小程序 |
|------|-----|--------|
| Agent 列表动态获取 | ✅ agent.list.get | ✅ agent.list.get |
| Agent 缓存 + 手动刷新 | ✅ localStorage + 🔄按钮 | ✅ wx.Storage + 🔄按钮 |
| Agent emoji 头像 | ✅ 消息气泡 + header | ✅ 消息气泡 + header |
| Agent model 信息显示 | ✅ | ✅ |
| Agent 切换 (agent.select) | ✅ API ready | ✅ API ready |

### 多服务器管理

| 功能 | Web | 小程序 |
|------|-----|--------|
| 添加服务器 (Pairing) | ✅ name/displayName/URL/token/chatId/senderId | ✅ 同上 |
| 服务器列表 (Profile) | ✅ | ✅ |
| 切换活跃服务器 | ✅ 点击激活 (绿勾) | ✅ 点击激活 (✓) |
| 编辑服务器 | ✅ 底部弹窗 6字段编辑 | ✅ 底部弹窗 6字段编辑 |
| 删除服务器 | ✅ | ✅ |

### 页面清单

| 页面 | Web | 小程序 |
|------|-----|--------|
| Onboarding (4卡轮播) | ✅ | ✅ |
| Pairing (连接配置) | ✅ | ✅ |
| ChatList / Agents (Agent列表) | ✅ | ✅ |
| ChatRoom (聊天) | ✅ | ✅ |
| Dashboard (channel.status) | ✅ 实时刷新 | ✅ 实时刷新 |
| Search | ✅ 空态 | ✅ 空态 |
| Profile (服务器管理+设置) | ✅ | ✅ |
| Preferences | ✅ | ✅ |

### UI 组件库

| 组件 | Web | 小程序 |
|------|-----|--------|
| Button (cva variants) | ✅ shadcn | ✅ 原生 wxss |
| Input | ✅ shadcn | ✅ 原生 |
| Card / GlassCard | ✅ shadcn | ✅ glass-card 组件 |
| Badge | ✅ shadcn | ✅ 原生 |
| BottomNav | ✅ GlassCard + motion | ✅ bottom-nav 组件 |
| message-bubble | ✅ 内联 JSX + Markdown | ✅ 组件 + 自写 MD |
| floating-panel | ✅ AnimatePresence | ✅ 组件 |
| emoji-picker | ✅ 内联 | ✅ 组件 |
| ActionCard | ✅ 组件 | ✅ 内联 WXML |

---

## 待办

| 优先级 | 事项 | 备注 |
|--------|------|------|
| � 低 | 多端实时同步 | 需服务端支持 |
| 🟢 低 | history.sync 按 agentId 隔离 | 服务端已支持，待验证 |

> 本文档用于当前阶段实施，不作为最终架构文档。