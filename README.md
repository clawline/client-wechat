# OpenClaw 微信小程序客户端

OpenClaw 微信小程序客户端，通过 WebSocket 连接 OpenClaw 服务器，提供实时 AI 对话、多服务器管理、离线消息队列等功能。基于微信小程序原生框架 + glass-easel 组件系统构建。

## 功能特性

### 实时聊天
- 流式消息接收（`text.delta` 增量渲染）
- AI 思考状态展示（思考中 / 分析中 / 整理中 / 仍在处理）
- 消息持久化到本地存储（每 agent 最多 200 条）
- 日期分隔符与时间戳
- 连续同发送者消息自动分组（3 分钟内）
- 断线重连提示横幅（点击重连）

### 多服务器管理
- 同时连接多个 OpenClaw 服务器
- Agent 列表按服务器分组显示
- 服务器间快速切换（自动设置 active connection）
- 连接参数编辑（名称、URL、Token、ChatId、SenderId）
- 支持 URL 连接、二维码扫描、手动配置三种配对方式
- 支持 `ws://`、`wss://`、`openclaw://` 协议

### 消息交互
- 表情回应（Reaction）增删，同步到服务器
- 引用回复（Quote Reply），附带原文预览
- 消息编辑，实时同步到服务器
- 消息删除，实时同步到服务器
- 发送失败重试（红色标记，点击重发）
- 消息投递状态（pending / sent / delivered / read / failed）

### 语音录制发送
- 使用 `wx.getRecorderManager` 录制 AAC 格式音频
- Base64 编码通过 WebSocket 发送
- 最长 60 秒录音
- 录制状态 UI 指示

### 图片发送
- 使用 `wx.chooseMedia` 选择图片
- Base64 编码通过 WebSocket 发送
- 支持 image/jpeg 格式

### 斜杠命令（22 条内置 + 动态 Skills）
- **Commands**: `/help`, `/commands`, `/status`, `/whoami`, `/skill`, `/stop`
- **Session**: `/new`, `/reset`, `/model`, `/models`, `/compact`, `/context`, `/export`
- **Directives**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/queue`
- **Advanced**: `/usage`, `/tts`
- 输入 `/` 自动弹出命令面板，支持模糊搜索过滤
- 动态加载 Agent Skills 到命令列表

### AI 建议
- 基于最近对话上下文请求 AI 生成回复建议
- 建议栏定时刷新（15 秒）
- 点击建议直接填入输入框
- 跟进提醒（Follow-up pill）

### 离线消息队列
- 断线时消息自动入队（Outbox），连接恢复后自动发送
- LRU 内存缓存 + `wx.Storage` 持久化
- 每个 connection + chat 最多 50 条队列消息
- 媒体负载上限 1MB
- in-flight 标记防重发

### WebSocket 连接池
- 页面切换时连接保活（15 秒 grace period）
- `acquire` / `release` / `rebind` 生命周期管理
- 页面 `onHide` 释放、`onShow` 重新获取，避免重复建连
- 心跳保活（25 秒间隔，10 秒超时自动重连）
- 指数退避重连（最多 6 次，最大 15 秒间隔）

### 全文消息搜索
- 扫描所有 `openclaw.msgs.*` 本地存储键
- 不区分大小写的文本匹配
- 最多返回 50 条结果
- 防抖搜索输入（250ms）

### 深色模式
- 通过 `openclaw.darkMode` 存储键切换
- Profile 页面开关控制
- 全局生效，各页面 `onShow` 时同步状态

### 服务器状态监控（Dashboard）
- 通过 `channel.status.get` 请求服务器状态
- 10 秒自动刷新
- 显示当前活跃服务器名称和连接状态

### 通知
- 应用内消息通知（Toast + 震动反馈）
- 可通过 Profile 开关控制推送通知和应用内通知
- 微信订阅消息框架已就绪（模板 ID 待配置）

### Markdown 渲染
- 支持段落、标题（h1-h3）、粗体、行内代码、代码块、有序/无序列表、引用、链接、分隔线
- 解析为结构化节点数组，由 WXML 模板渲染

## 页面结构

小程序共 9 个页面，在 `app.json` 中注册：

| 页面 | 路径 | 说明 |
|------|------|------|
| Entry | `pages/entry/index` | 启动路由分发：已配对跳转 Agents，未配对跳转 Onboarding |
| Onboarding | `pages/onboarding/index` | 功能介绍轮播（4 张 Feature Slide），引导进入配对 |
| Pairing | `pages/pairing/index` | 服务器配对：URL 输入 / 二维码扫描 / 手动填写 |
| Agents | `pages/agents/index` | Agent 列表（多服务器分组），搜索过滤，网格/列表视图切换 |
| Chat Room | `pages/chat-room/index` | 聊天主界面：消息收发、流式回复、斜杠命令、表情、语音、图片 |
| Dashboard | `pages/dashboard/index` | 服务器状态监控面板 |
| Search | `pages/search/index` | 全文消息搜索 |
| Profile | `pages/profile/index` | 设置中心：服务器管理、深色模式、通知开关 |
| Preferences | `pages/preferences/index` | 偏好设置：显示名称、模型选择、Temperature、System Prompt |

底部导航栏（4 个 Tab）：对话 / 资源 / 搜索 / 设置

## 技术架构

### 组件框架
- 使用 `glass-easel` 组件框架（`app.json` 中 `componentFramework: "glass-easel"`）
- 自定义导航栏（`navigationStyle: "custom"`）
- 惰性代码加载（`lazyCodeLoading: "requiredComponents"`）

### 共享组件（9 个）
`bottom-nav` / `chat-item` / `emoji-picker` / `floating-panel` / `glass-card` / `icon` / `message-bubble` / `progress-bar` / `setting-item`

### WebSocket 连接池（`ws-pool.js`）
页面切换时不断开 WebSocket，而是将连接放入池中，15 秒内如果有页面重新 acquire 则复用：

```
Page onLoad → wsPool.acquire(key, factory) → 新建或复用连接
Page onHide → wsPool.rebind(key, null) + wsPool.release(key, 15000) → 解绑回调，启动 idle 计时
Page onShow → wsPool.acquire(key) → 取消 idle 计时，rebind 回调到当前页面实例
Page onUnload → wsPool.release(key) → 释放到池中（grace period 后自动关闭）
```

### 消息持久化
- 存储键格式：`openclaw.msgs.{agentId}.{connectionId}`
- 每个 agent 最多保留 200 条消息
- 内存中最多保留 300 条（防止 `setData` 性能劣化）
- 消息合并策略（`message-merge.js`）：按 ID 去重，字段级合并，时间戳排序

### 离线队列（`outbox.js`）
- 存储键格式：`openclaw.outbox.{connectionId}.{chatId}`
- LRU 内存缓存（最多 20 个 key），减少 JSON.parse 开销
- 支持 text / media / file 三种消息类型
- 连接恢复后自动 flush（每次最多 10 条）

### 错误处理（`errors.js`）
- 分类策略：error code 优先，string 模式匹配兜底
- 12 种错误码映射为中文提示
- 聊天界面顶部 Toast 展示（3 秒自动消失）

### 状态管理（`app-state.js`）
- 基于 `getApp().globalData.runtime` 的全局运行时状态
- 包含 agents 列表、消息仓库、连接参数、偏好表单
- 从 `wx.Storage` 同步初始化，运行时内存操作

### 依赖
- `zustand` ^5.0.12 （package.json 声明，当前主要使用原生状态管理）

## 开发指南

### 环境要求
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）
- Node.js（用于 npm 依赖安装和资源生成脚本）

### 安装依赖

```bash
cd client-wechat
npm install
```

### 开发调试

1. 打开微信开发者工具
2. 选择"导入项目"，项目目录指向 `client-wechat/`
3. AppID 使用测试号或你自己的小程序 AppID
4. 在开发者工具中点击"工具 -> 构建 npm"
5. 编译运行

### 资源生成

如果删除了 `assets/` 目录，执行以下命令重新生成 SVG 资源：

```bash
node scripts/generate_assets.mjs
```

### 真机调试注意事项
- 微信小程序真机和正式环境要求 `wss://` 合法域名
- 需要在小程序管理后台配置 WebSocket 合法域名
- 开发者工具中可勾选"不校验合法域名"用于本地调试

## 本地存储 Schema

| 存储键 | 类型 | 说明 |
|--------|------|------|
| `openclaw.generic.senderId` | string | 当前用户 Sender ID |
| `openclaw.generic.senderName` | string | 当前用户显示名称 |
| `openclaw.generic.serverUrl` | string | 服务器 WebSocket 地址（旧版单服务器） |
| `openclaw.generic.paired` | `"true"` / `"false"` | 是否已配对 |
| `openclaw.connections` | JSON string (array) | 多服务器连接列表 |
| `openclaw.activeConnectionId` | string | 当前活跃的服务器连接 ID |
| `openclaw.agentList` | JSON string (array) | 缓存的 Agent 列表 |
| `openclaw.msgs.{agentId}.{connId}` | JSON string (array) | 持久化的聊天消息 |
| `openclaw.outbox.{connId}.{chatId}` | JSON string (array) | 离线消息队列 |
| `openclaw.darkMode` | `"0"` / `"1"` | 深色模式开关 |
| `openclaw.pushNotif` | `"0"` / `"1"` | 推送通知开关 |
| `openclaw.inAppNotif` | `"0"` / `"1"` | 应用内通知开关 |

## 与 Web 端的功能差异

| 特性 | Web 端 | 小程序 |
|------|--------|--------|
| 组件框架 | React + Vite | 原生小程序 + glass-easel |
| WebSocket | 浏览器原生 WebSocket | `wx.connectSocket` + 连接池 |
| 离线队列 | 无 | LRU 缓存 + wx.Storage 持久化 |
| 消息搜索 | 服务器端搜索 | 本地 wx.Storage 全文扫描 |
| 文件上传 | HTTP 上传 | Base64 编码通过 WebSocket |
| 语音录制 | Web Audio API | `wx.getRecorderManager` (AAC) |
| 导航 | React Router | 小程序页面栈 + 自定义 Tab 切换 |
| 动画 | CSS transitions / Framer Motion | `wx.createAnimation` + CSS |
| 毛玻璃效果 | `backdrop-filter` | 半透明底色 + 边框 + 渐变替代 |
| hover 效果 | CSS `:hover` | tap / long-press 反馈替代 |
| 深色模式 | CSS `prefers-color-scheme` | 手动切换 + wx.Storage |
| 通知 | Web Notification API | 微信订阅消息（模板 ID 待配置） |
| 状态管理 | Zustand (React) | `getApp().globalData.runtime` |
| 消息持久化 | 无（仅内存） | wx.Storage（每 agent 200 条） |
| Markdown | react-markdown | 自定义解析器 + WXML 模板 |

## 目录说明

```
client-wechat/
  app.json              # 页面注册、窗口配置
  app.js                # 小程序入口
  app.wxss              # 全局样式
  pages/                # 9 个页面
    entry/              # 启动路由
    onboarding/         # 引导页
    pairing/            # 服务器配对
    agents/             # Agent 列表
    chat-room/          # 聊天主界面
    dashboard/          # 服务器状态
    search/             # 消息搜索
    profile/            # 设置中心
    preferences/        # 偏好设置
  components/           # 9 个共享组件
  utils/                # 工具模块
    generic-channel.js  # WebSocket 客户端、连接管理
    ws-pool.js          # 连接池
    outbox.js           # 离线消息队列
    app-state.js        # 全局状态管理
    message-merge.js    # 消息合并策略
    markdown.js         # Markdown 解析器
    navigation.js       # 导航配置
    routes.js           # 页面路由
    layout.js           # 布局计算（安全区、导航栏）
    notifications.js    # 通知管理
    errors.js           # 错误分类与提示
    animate.js          # 动画工具
  mock/                 # Mock 数据（斜杠命令、表情、默认配置）
  theme/                # 设计令牌
  assets/               # 图标、头像、插画
  scripts/              # 资源生成脚本
```
