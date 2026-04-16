# OpenClaw 小程序 Parity Checklist

说明：

- 下列 `已落地` 项表示代码已在仓库内实现并可运行
- 下列 `待验证` 项表示代码已写但需在微信开发者工具和真机上验收
- 下列 `未实现` 项表示功能尚未移植或小程序平台不支持

## 已落地：页面

- [x] entry（启动路由分发，自动跳转 agents 或 onboarding）
- [x] onboarding（Feature Slide 轮播，自动播放 4 秒切换）
- [x] pairing（URL 连接 / 二维码扫描 / 手动填写，支持 ws/wss/openclaw 协议）
- [x] agents（多服务器 Agent 列表，按服务器分组，网格/列表视图切换）
- [x] chat-room（聊天主界面，流式消息，斜杠命令，表情，语音，图片）
- [x] dashboard（服务器状态监控，10 秒自动刷新）
- [x] search（本地全文消息搜索，防抖 250ms）
- [x] profile（设置中心，多服务器管理，深色模式/通知开关）
- [x] preferences（偏好设置，模型选择，Temperature 滑块）

## 已落地：WebSocket 通信

- [x] GenericChannelClient 完整实现
- [x] 心跳保活（25 秒 ping，10 秒 pong 超时）
- [x] 指数退避自动重连（最多 6 次，最大间隔 15 秒）
- [x] 连接池（ws-pool.js）：acquire / release / rebind / destroy
- [x] 页面切换 15 秒 grace period 保活
- [x] connection.open 处理（服务器分配 chatId）
- [x] agent.list / agent.select 协议
- [x] history.get / history.sync 历史消息
- [x] text.delta 流式增量渲染
- [x] stream.resume 恢复进行中的流式回复
- [x] message.send / message.receive 收发消息
- [x] message.edit / message.delete 编辑删除
- [x] reaction.add / reaction.remove 表情回应
- [x] thinking.start / thinking.update / thinking.end 思考状态
- [x] typing 对方输入状态指示（5 秒超时）
- [x] status.delivered / status.read 投递状态更新
- [x] suggestion.get / suggestion.response AI 建议
- [x] channel.status.get 服务器状态查询
- [x] conversation.list.get 对话列表请求

## 已落地：消息功能

- [x] 文本消息发送与接收
- [x] 引用回复（parentId + quotedText）
- [x] 消息编辑（本地 + 发送 message.edit）
- [x] 消息删除（本地 + 发送 message.delete）
- [x] 表情回应增删（本地乐观更新 + 服务器同步）
- [x] 图片选择发送（wx.chooseMedia + Base64）
- [x] 语音录制发送（RecorderManager + AAC + Base64）
- [x] 文件发送（sendFile 方法已实现）
- [x] 消息投递状态显示（pending / sent / delivered / read / failed）
- [x] 发送失败重试
- [x] 日期分隔符
- [x] 连续消息分组（同发送者 3 分钟内合并）
- [x] 消息合并策略（按 ID 去重，字段级合并，时间戳排序）

## 已落地：离线队列

- [x] 断线时消息自动入队（outbox.js）
- [x] LRU 内存缓存（最多 20 key）
- [x] wx.Storage 持久化
- [x] 每 connection+chat 最多 50 条
- [x] 媒体负载上限 1MB
- [x] 连接恢复自动 flush（每次最多 10 条）
- [x] in-flight 标记防重发

## 已落地：斜杠命令

- [x] 22 条内置命令（help/commands/status/whoami/skill/stop/new/reset/model/models/compact/context/export/think/verbose/reasoning/elevated/exec/queue/usage/tts）
- [x] 输入 `/` 自动弹出命令面板
- [x] 模糊搜索过滤
- [x] 选择命令后直接发送
- [x] 动态加载 Agent Skills 到命令列表

## 已落地：UI 交互

- [x] 自定义导航栏（安全区 + 胶囊按钮适配）
- [x] 底部导航四页切换（对话/资源/搜索/设置）
- [x] Agent 列表搜索过滤（200ms 防抖）
- [x] Agent 列表网格/列表视图切换
- [x] emoji picker 写入输入框或添加 reaction
- [x] 多服务器管理（添加/编辑/删除/切换活跃服务器）
- [x] 深色模式切换
- [x] 通知开关（推送通知 / 应用内通知）
- [x] 思考状态动态文案（思考中 → 分析中 → 整理中 → 仍在处理）
- [x] 断线重连横幅（点击重连）
- [x] 错误 Toast（中文提示，3 秒自动消失）
- [x] AI 建议栏（15 秒定时刷新 + 手动请求）
- [x] 消息气泡长按操作菜单（回复/编辑/删除/表情）
- [x] 附件菜单（图片/语音）
- [x] 录音状态指示
- [x] 快捷操作卡片（检测 /help 回复中的命令列表）

## 已落地：动画与平台等效替代

- [x] 页面壳切屏位移 + 淡入
- [x] 列表卡片顺序入场
- [x] 按钮按压缩放
- [x] slash / emoji 面板打开关闭
- [x] progress bar 进度动画
- [x] API status ping 动画
- [x] 毛玻璃统一改为半透明底色 + 边框 + 渐变 + 阴影
- [x] hover 细节统一改为 tap / long-press 反馈
- [x] sticky 结构统一改为固定头部 + 独立滚动区

## 已落地：数据持久化

- [x] 消息本地持久化（每 agent 200 条）
- [x] Agent 列表缓存（openclaw.agentList）
- [x] 多服务器连接列表持久化（openclaw.connections）
- [x] 深色模式 / 通知偏好持久化
- [x] 离线队列持久化（openclaw.outbox.*）

## 已落地：错误处理

- [x] 12 种错误码分类（NOT_CONNECTED / SEND_FAILED / TIMEOUT / RATE_LIMITED 等）
- [x] 中文错误提示映射
- [x] code-first + string-fallback 分类策略
- [x] 聊天界面 Toast 展示（3 秒自动消失）

## 已落地：Markdown 渲染

- [x] 标题（h1-h3）
- [x] 粗体
- [x] 行内代码
- [x] 代码块（带语言标识）
- [x] 有序/无序列表
- [x] 引用块
- [x] 链接
- [x] 分隔线
- [x] 段落

## 待验证：开发者工具 / 真机验收

- [ ] 微信开发者工具中完整打开项目目录
- [ ] iOS 真机检查安全区、滚动、输入框与键盘顶起
- [ ] Android 真机检查滚动、阴影、面板动画与输入区
- [ ] 对照 Web 原型补齐静态截图基线
- [ ] 对照 Web 原型补齐关键动态录屏基线
- [ ] 确认标准渲染模式下动画足够流畅，再决定是否局部切回 Skyline / Worklet

## 未实现 / 与 Web 端差异

- [ ] 服务器端消息搜索（小程序仅支持本地搜索）
- [ ] HTTP 文件上传（小程序使用 Base64 通过 WebSocket）
- [ ] Web Notification API（小程序使用订阅消息，模板 ID 待配置）
- [ ] CSS `backdrop-filter` 毛玻璃（已用半透明替代方案）
- [ ] 登出功能（Profile 页 handleLogout 为 mock 实现）
- [ ] Dashboard 详细数据卡片（usageCards / tasks / checkpoints 为空数组）
