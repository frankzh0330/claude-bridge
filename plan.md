# Plan

## Telegram 交互式权限审批

通过 SDK 的 `canUseTool` 回调，把 Claude Code 的权限请求转发到 Telegram，用户通过 inline 按钮实时审批。

### 实现思路

1. `src/claude.ts` 中 `query()` 的 options 传入 `canUseTool` 回调
2. 回调内通过 bot 实例发送 inline keyboard 消息到 Telegram
3. 用 Grammy 的 `callbackQuery` handler 等待用户点击按钮
4. 根据用户选择返回 `PermissionResult`（allow/deny）
5. 支持「总是允许」选项，将规则写入 session 权限

### 涉及文件

- `src/claude.ts` — 添加 canUseTool 回调，接收 bot 实例用于发消息
- `src/bot.ts` — 创建 bot 时注册 callbackQuery handler，暴露权限响应的 Promise 机制
- `src/types.ts` — 添加 PermissionRequest 相关类型

### 效果示例

```
Claude 想执行: Bash(npm test)
路径: /Users/frank/project
[✅ 允许] [🔒 总是允许] [❌ 拒绝]
```

### 依赖

- SDK 类型: `CanUseTool`, `PermissionResult`, `PermissionUpdate`
- Grammy: `InlineKeyboard`, `callbackQuery` handler
