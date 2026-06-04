# Vocabulary iknow

个人英语单词学习 Web 应用。支持拍照 OCR / 粘贴文本导入词库，每日测试、错词本、强化复习与学习报告，数据按用户隔离存储在本地 SQLite。

## 功能

- **导入单词**：上传图片（JPG / PNG / HEIC，含 iPhone 照片）或粘贴文本，识别后可编辑再入库；大图片自动压缩
- **每日测试**：**今日新词** + **SRS 到期复习**；英译中、中译英、听写三种模式，自动判分（正确 / 拼写错误 / 释义错误 / 完全不会）
- **AI 翻译**：词库优先匹配，未命中可走 LLM（需配置 API Key）
- **Token 消耗**：按模型统计输入/输出 Token，可设每日上限（经统一 AI 网关计费与拦截）
- **强化复习**：按近 7 天错误频率生成复习列表，在测试页进行针对性练习
- **学习报告**：每日统计、近 7 日趋势、连续学习天数
- **错词本**：汇总测试出错的单词及错误类型
- **词库管理**：搜索、编辑、批量删除、一键清空、**CSV 导出**（Excel 兼容编码）
- **单词发音**：测试与词库中可播放英文发音（Dictionary API）
- **用户登录**：注册 / 登录，每位用户独立词库；全站最多 **5 个用户**
- **模型服务**：每位用户自行配置 AI API Key 与模型（可选）；Key 在设置 `KEY_ENCRYPTION_SECRET` 后加密存库
- **界面**：简体中文 / English 切换；浅色 / 深色 / 跟随系统；桌面侧边栏 + 移动端底部导航

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、React Router、Vite |
| 后端 | Express、TypeScript |
| 数据库 | SQLite（better-sqlite3） |
| OCR | 用户自配 AI 识图 / 本地 Tesseract（默认） |
| 图像 | Sharp（HEIC 转换、预处理） |

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
| `ALLOW_REGISTRATION` | 设为 `false` 关闭公开注册（管理员后台也无法开启） | 允许注册 |
| `ADMIN_USERNAME` | 管理员用户名（启动时自动创建或提升） | — |
| `ADMIN_PASSWORD` | 管理员密码（至少 6 位） | — |
| `KEY_ENCRYPTION_SECRET` | API Key 数据库加密主密钥（建议 ≥32 字符随机串） | 不加密明文存储 |

> **AI / OCR 不在 `.env` 配置 Key 本身。** 每位登录用户在 **「模型」**（`/settings/api`）填写 API Key；偏好与 OCR 引擎在 `user_ai_settings`，各厂商 Key 在 `user_ai_provider_configs`。所有 LLM 调用经服务端 **AI 网关** 统一记账，并可在 **「Token 消耗」**（`/tokens`）设置每日 Token 上限。

## 模型服务（每用户独立）

登录后进入 **「模型」** 页面，可配置：

- 服务商：DashScope、DeepSeek、OpenAI、Moonshot 或 OpenAI 兼容接口
- API Key、Base URL（DashScope 支持国内 / 国际 / 美国区域）
- 识图 / OCR 模型、结构化解析模型
- OCR 引擎偏好：自动 / AI 识图 / 本地 Tesseract

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

管理员登录后，侧边栏会出现 **「管理」** 入口（`/admin`），可：

- 查看用户数量、今日测试量、近 7 日活跃用户
- **开关公开注册**（`ALLOW_REGISTRATION=false` 时此项被环境变量锁定）
- 重置用户密码、删除用户（同时删除其单词、测试记录和 AI 配置）
- 授予 / 撤销其他用户的管理员权限

> 全站用户上限为 **5 人**，达到上限后即使注册开关开启也无法继续注册。

## Docker 部署

```bash
cp .env.example .env   # 填写 PORT、管理员等（无需 AI Key）
docker compose up -d --build
```

访问 http://localhost:3000

镜像已内置 Tesseract（英 / 中）及 HEIC 解码依赖。`./data` 目录会挂载到容器内，数据库持久化在 `data/vocabulary.db`。更新代码后重新 `docker compose up -d --build` 即可，数据不会丢失。

## Nginx 反向代理

生产环境可在 Docker 前加 Nginx。参考 `deploy/nginx/site.conf.example`：

```bash
# 复制并修改域名、端口后部署
cp deploy/nginx/site.conf.example /etc/nginx/conf.d/vocabulary-know.conf
# 自定义 502/503/504 页面
cp -r deploy/nginx/error-pages /var/www/vocabulary-know/
```

示例配置将 `/` 反向代理到 `127.0.0.1:3000`，并在容器重启时展示友好错误页。

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
├── src/                  # React 前端
│   ├── components/       # 布局、主题、语言、导航等
│   ├── i18n/             # 中英文文案
│   └── pages/            # 各功能页面
├── server/               # Express 后端
│   ├── routes/           # API 路由
│   ├── services/         # 业务逻辑（词库、测试、OCR、认证）
│   └── db.ts             # SQLite 初始化与迁移
├── deploy/nginx/         # Nginx 配置与错误页示例
├── data/                 # 数据库文件（gitignore，需自行备份）
├── dist/                 # 构建输出
├── Dockerfile
└── docker-compose.yml
```

## 数据备份

数据库文件位于 `data/vocabulary.db`（或 `DB_PATH` 指定路径）。部署到服务器时，备份 / 迁移只需拷贝该文件及 `-wal`、`-shm` 附属文件（如有）。
