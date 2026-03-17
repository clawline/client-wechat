# OpenClaw 微信小程序

这是当前 Web 原型对应的原生微信小程序版本，代码完全隔离在 `miniprogram/` 目录，原有 Vite/React 原型不做改动。

## 打开方式

1. 打开微信开发者工具。
2. 选择 “导入项目”。
3. 项目目录指向当前仓库下的 [miniprogram](/Users/leway/Projects/clawline-client-wechat/miniprogram)。
4. AppID 使用测试号或你自己的小程序 AppID。

## 目录说明

- `pages/onboarding` / `pages/pairing` / `pages/agents` / `pages/chat-room`: 登录引导、连接配置、Agent 列表与聊天主流程
- `pages/dashboard` / `pages/search` / `pages/profile` / `pages/preferences`: 资源页、搜索页、个人页与偏好设置
- `components`: 共享 UI 组件
- `mock`: 本地 mock 数据
- `theme`: 设计令牌
- `utils`: 路由、连接状态和 Generic Channel 封装
- `assets`: 本地图标、头像、插画
- `scripts/generate_assets.mjs`: 生成 SVG 图标与本地矢量资源

## 资源生成

如果你删掉了 `assets/` 目录，执行下面命令可重新生成 SVG 资源：

```bash
node miniprogram/scripts/generate_assets.mjs
```

## Generic Channel 接入

当前聊天页已经按 `clawline` 的 WebSocket 协议接入 OpenClaw。

- 默认远端地址不再写死在页面里，首次进入请在 `Pairing` 页面填写
- 已保存的连接参数可在 `Preferences` 页面修改
- 聊天会话通过 `?chatId=...` 建连，消息按 `type: "message.receive"` 发送

本地探测脚本：

```bash
node miniprogram/scripts/probe_generic_channel.mjs
```

说明：

- 这个默认地址适合当前测试环境
- 微信小程序真机和正式环境通常要求 `wss://` 合法域名；如果后续要上真机联调，需要给测试环境补 TLS 和业务域名配置
