# OpenClaw 小程序 Parity Checklist

说明：

- 下列 `已落地` 项表示代码结构、状态机、模板和样式已在仓库内实现
- 下列 `待验证` 项表示仍需在微信开发者工具和真机上逐项走查后才能算验收完成

## 已落地：静态页面

- [x] onboarding
- [x] chat list
- [x] chat room idle
- [x] chat room slash menu open
- [x] chat room emoji picker open
- [x] dashboard
- [x] profile
- [x] search
- [x] preferences

## 已落地：交互

- [x] onboarding 进入 chats
- [x] 底部导航四页切换
- [x] chats 搜索过滤
- [x] chat item 进入 chat room
- [x] chat room 返回 chats
- [x] `/` 唤起 slash menu
- [x] 选择 slash command 后回填输入框
- [x] emoji picker 写入输入框
- [x] reaction 增删切换
- [x] 发送消息后 mock AI 回复
- [x] profile 进入 preferences 并返回

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

## 待验证：开发者工具 / 真机验收

- [ ] 微信开发者工具中完整打开 `miniprogram/`
- [ ] iOS 真机检查安全区、滚动、输入框与键盘顶起
- [ ] Android 真机检查滚动、阴影、面板动画与输入区
- [ ] 对照 Web 原型补齐静态截图基线
- [ ] 对照 Web 原型补齐关键动态录屏基线
- [ ] 确认标准渲染模式下动画足够流畅，再决定是否局部切回 Skyline / Worklet
