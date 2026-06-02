# Vocabulary iknow

个人英语单词学习 Web 应用。支持拍照 OCR / 粘贴文本导入词库，每日测试、错词本、周报与复习计划，数据按用户隔离存储在本地 SQLite。

## 功能

- **导入单词**：上传图片（JPG / PNG / HEIC）或粘贴文本，识别后可编辑再入库
- **每日测试**：英译中、中译英，自动判分（正确 / 拼写错误 / 释义错误 / 完全不会）
- **学习报告**：每日统计、历史趋势、连续打卡天数
- **错词本**：汇总测试出错的单词
- **周复习**：按近 7 天错误频率生成复习列表
- **词库管理**：查看、编辑、批量删除单词
- **用户登录**：注册 / 登录，每位用户独立词库
- **模型服务**：每位用户自行配置 AI API Key 与模型（可选）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、React Router、Vite |
| 后端 | Express、TypeScript |
| 数据库 | SQLite（better-sqlite3） |
| OCR | 用户自配 AI 识图 / 本地 Tesseract（默认） |

## 本地开发

### 环境要求

- Node.js 22+
- macOS / Linux（`predev` 脚本依赖 `lsof`，用于释放 3000 端口）

### 启动

```bash
npm install
cp .env.example .env   # 按需填写端口、管理员等
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000（Vite 已代理 `/api`）

首次使用在登录页注册账号即可。若数据库中已有未归属的旧单词，**第一个注册的用户**会自动继承这些数据。

### 生产构建

```bash
npm run build
npm start
```

构建产物位于 `dist/client`（前端）和 `dist/server`（后端），`npm start` 会在同一端口同时提供 API 与静态页面。

## 环境变量

`.env` 仅用于**服务器部署与运维**，与 AI 无关。复制 `.env.example` 为 `.env` 后按需配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DB_PATH` | SQLite 文件路径 | `data/vocabulary.db` |
| `ALLOW_REGISTRATION` | 设为 `false` 关闭公开注册 | 允许注册 |
| `ADMIN_USERNAME` | 管理员用户名（启动时自动创建或提升） | — |
| `ADMIN_PASSWORD` | 管理员密码（至少 6 位） | — |

> **AI / OCR 不在 `.env` 配置。** 每位登录用户在侧边栏 **「模型」**（`/settings/api`）填写自己的 API Key、接口地址和模型，配置保存在数据库 `user_ai_settings` 表中。

## 模型服务（每用户独立）

登录后进入 **「模型」** 页面，可配置：

- 服务商：DashScope、DeepSeek、OpenAI、Moonshot 或 OpenAI 兼容接口
- API Key、Base URL
- 识图 / OCR 模型、翻译模型、OCR 引擎偏好

| 是否配置 Key | 图片 OCR | AI 翻译 |
|--------------|----------|---------|
| 未配置 | 仅本地 **Tesseract** | 不可用（词库匹配仍可用） |
| 已配置 | 按设置使用 AI 识图 | 可用 |

用户之间配置互不影响；清除 Key 后恢复为 Tesseract 模式。

## 管理后台

在 `.env` 中配置管理员账号后重启服务：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

- 若该用户名已存在，会被提升为管理员并重置密码
- 若不存在，会自动创建管理员账号

管理员登录后，侧边栏会出现 **「管理」** 入口（`/admin`），可查看用户数量、各用户单词数，并重置密码或删除用户。删除用户会同时删除其全部单词、测试记录和 AI 配置。

## Docker 部署

```bash
cp .env.example .env   # 填写 PORT、管理员等（无需 AI Key）
docker compose up -d --build
```

访问 http://localhost:3000

`./data` 目录会挂载到容器内，数据库持久化在 `data/vocabulary.db`。更新代码后重新 `docker compose up -d --build` 即可，数据不会丢失。

## 粘贴文本导入格式

每行一个词条，英文与中文之间用空格或常见分隔符隔开，例如：

```
apple 苹果
banana - 香蕉
1. foreigner n. 外国人
```

识别后可在页面上编辑，确认无误再点击「确认导入」。

## 项目结构

```
├── src/              # React 前端
├── server/           # Express 后端
│   ├── routes/       # API 路由
│   ├── services/     # 业务逻辑（词库、测试、OCR、认证）
│   └── db.ts         # SQLite 初始化与迁移
├── data/             # 数据库文件（gitignore，需自行备份）
├── dist/             # 构建输出
├── Dockerfile
└── docker-compose.yml
```

## 数据备份

数据库文件位于 `data/vocabulary.db`（或 `DB_PATH` 指定路径）。部署到服务器时，备份 / 迁移只需拷贝该文件及 `-wal`、`-shm` 附属文件（如有）。
