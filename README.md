# TG-Claude-Bridge

通过 Telegram Bot 桥接 Claude Code CLI，在 Telegram 中直接与 Claude Code 对话。

## 功能

- 多 Bot 支持：每个 Bot 绑定不同的工作目录，互不干扰
- 流式输出：实时预览 Claude 的回复，完成后发送完整结果
- 会话续接：自动保持上下文，`/new` 可重置
- 用户认证：仅允许指定 Telegram 用户使用
- 消息过期过滤：自动丢弃超时消息

## 前提条件

- Node.js 18+
- 本机已安装并登录 Claude Code CLI（`claude` 命令可用）

## 安装

```bash
git clone <repo-url>
cd tg-claude-bridge
npm install
```

## 配置

复制环境变量模板并编辑：

```bash
cp .env.example .env
```

### 获取 Telegram Bot Token

在 Telegram 中找 [@BotFather](https://t.me/BotFather)，发送 `/newbot` 创建 Bot，获取 token。

### 获取你的 User ID

在 Telegram 中找 [@userinfobot](https://t.me/userinfobot)，获取数字 ID。

### .env 配置说明

```env
# 必填
ALLOWED_USER_ID=你的Telegram数字ID

# 单 Bot 模式
BOT_TOKEN=your-bot-token
BOT_CWD=/path/to/your/project

# 多 Bot 模式（二选一）
BOT_1_TOKEN=bot1-token
BOT_1_CWD=/path/to/project-a
BOT_2_TOKEN=bot2-token
BOT_2_CWD=/path/to/project-b

# 可选
BOT_MAX_TURNS=30              # 所有 Bot 默认最大轮次
BOT_MAX_BUDGET_USD=1.0        # 所有 Bot 默认最大预算
BOT_1_MAX_TURNS=50            # 单独设置某个 Bot 的轮次
MESSAGE_EXPIRY_MINUTES=20     # 消息过期时间（分钟）
```

## 启动

### 前台运行（开发调试）

```bash
npm run dev
```

### 后台运行

```bash
nohup npm run dev > /tmp/tg-bridge.log 2>&1 < /dev/null &
```

查看日志：

```bash
tail -f /tmp/tg-bridge.log
```

### 使用 pm2（推荐）

```bash
npm install -g pm2
pm2 start "npm run dev" --name tg-bridge

pm2 logs tg-bridge      # 查看日志
pm2 restart tg-bridge   # 重启
pm2 stop tg-bridge      # 停止
pm2 status              # 状态
```

## 停止

后台运行时：

```bash
pkill -f "tsx.*src/index.ts"
```

使用 pm2 时：

```bash
pm2 stop tg-bridge
```

## Telegram 命令

| 命令 | 说明 |
|------|------|
| 任意文字 | 发送给 Claude Code 处理 |
| `/start` | 显示帮助信息和当前工作目录 |
| `/new` | 重置对话，开始新会话 |
| `/stop` | 取消正在处理的请求 |
| `/status` | 查看当前会话状态 |

## 项目结构

```
src/
├── index.ts         # 入口，启动多 Bot
├── config.ts        # 环境变量加载，多 Bot 配置
├── bot.ts           # Grammy Bot 创建，消息处理
├── claude.ts        # Claude Agent SDK 流式调用
├── message-utils.ts # 消息分块（适配 Telegram 4096 字符限制）
└── types.ts         # 类型定义
```
