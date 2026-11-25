# OpenPoke 部署指南

本文档详细说明如何部署 OpenPoke 项目到生产环境。

## 架构概览

OpenPoke 采用前后端分离架构：

- **前端**：Next.js 15 应用 → 部署在 **Vercel**
- **后端**：FastAPI Python 应用 → 部署在 **Railway**
- **数据库**：MySQL（远程，如 PlanetScale、Railway MySQL 等）

## 前置要求

### 1. 账户准备

- [Vercel](https://vercel.com/) 账户（前端部署）
- [Railway](https://railway.app/) 账户（后端部署）
- MySQL 数据库服务（PlanetScale、Railway MySQL、Supabase MySQL 等）
- [OpenRouter](https://openrouter.ai/) API 密钥
- [Composio](https://composio.dev/) API 密钥（用于 Gmail 集成）

### 2. 本地工具

- Node.js 18+ 和 pnpm 9+
- [uv](https://github.com/astral-sh/uv)（Python 包管理器）

## 部署步骤

### 第一步：准备数据库

1. **创建 MySQL 数据库**
   - 推荐使用 [PlanetScale](https://planetscale.com/) 或 Railway MySQL
   - 记录数据库连接信息：
     - `DATABASE_HOST`
     - `DATABASE_USERNAME`
     - `DATABASE_PASSWORD`
     - `DATABASE_NAME`（默认为 `openpoke`）

2. **推送数据库 Schema**
   ```bash
   # 在本地配置好 .env 后运行
   pnpm run db:push
   ```

### 第二步：部署后端（Railway）

1. **创建 Railway 项目**
   - 登录 [Railway](https://railway.app/)
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"（推荐）或 "Empty Project"

2. **配置项目**
   - 如果从 GitHub 部署，选择你的仓库
   - Railway 会自动检测 `railway.json` 配置
   - 设置根目录为 `apps/server`

3. **配置环境变量**
   在 Railway 项目设置中添加以下环境变量：

   ```bash
   # 应用配置
   APP_NAME=OpenPoke Server
   APP_VERSION=0.3.0

   # AI 模型配置（可选，有默认值）
   INTERACTION_AGENT_MODEL=openai/gpt-5-mini
   EXECUTION_AGENT_MODEL=openai/gpt-5-mini
   EXECUTION_AGENT_SEARCH_MODEL=openai/gpt-5-mini
   SUMMARIZER_MODEL=openai/gpt-5-mini
   EMAIL_CLASSIFIER_MODEL=openai/gpt-5-mini

   # API 密钥
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   COMPOSIO_API_KEY=your_composio_api_key_here
   COMPOSIO_GMAIL_AUTH_CONFIG_ID=your_gmail_auth_config_id_here

   # 数据库配置
   DATABASE_HOST=your_database_host
   DATABASE_USERNAME=your_database_username
   DATABASE_PASSWORD=your_database_password
   DATABASE_NAME=openpoke

   # Better Auth（与前端共享）
   BETTER_AUTH_SECRET=your_random_secret_key_here

   # 前端 URL（用于 CORS 和回调）
   FRONTEND_URL=https://your-app.vercel.app
   NEXT_PUBLIC_PY_BACKEND_URL=https://your-backend.railway.app

   # Rate Limiting（可选，Upstash Redis）
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

   # CORS（可选，默认允许所有）
   CORS_ALLOW_ORIGINS_RAW=https://your-app.vercel.app
   ```

4. **部署设置**
   - Railway 会自动使用 `railway.json` 中的配置
   - 启动命令：`uv run uvicorn app:app --host 0.0.0.0 --port 8001`
   - Railway 会自动安装 uv 并同步依赖

5. **获取后端 URL**
   - 部署成功后，Railway 会提供一个公共 URL
   - 格式类似：`https://your-project.up.railway.app`
   - 记录此 URL，用于前端配置

### 第三步：部署前端（Vercel）

1. **创建 Vercel 项目**
   - 登录 [Vercel](https://vercel.com/)
   - 点击 "Add New Project"
   - 导入你的 GitHub 仓库

2. **配置项目设置**
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/app`
   - **Build Command**: `pnpm run build`（自动检测）
   - **Output Directory**: `.next`（自动检测）
   - **Install Command**: `pnpm install`

3. **配置环境变量**
   在 Vercel 项目设置 → Environment Variables 中添加：

   ```bash
   # Better Auth
   BETTER_AUTH_SECRET=your_random_secret_key_here（与后端相同）
   BETTER_AUTH_URL=https://your-app.vercel.app

   # 数据库配置
   DATABASE_HOST=your_database_host
   DATABASE_USERNAME=your_database_username
   DATABASE_PASSWORD=your_database_password

   # API 密钥
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   COMPOSIO_API_KEY=your_composio_api_key_here
   COMPOSIO_GMAIL_AUTH_CONFIG_ID=your_gmail_auth_config_id_here

   # Google OAuth（用于 Better Auth）
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # 后端 URL
   NEXT_PUBLIC_PY_BACKEND_URL=https://your-backend.railway.app

   # 前端 URL
   NEXT_PUBLIC_SERVER_URL=https://your-app.vercel.app

   # 后端服务令牌（用于 API 认证）
   PY_SERVICE_TOKEN=your_service_token_here

   # Rate Limiting（可选）
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   ```

4. **配置 Cron Jobs**
   - Vercel 会自动读取 `vercel.json` 中的 cron 配置
   - 当前配置：每天凌晨 2 点执行清理任务
   - 确保在 Vercel 项目设置中启用 Cron Jobs

5. **部署**
   - 点击 "Deploy"
   - Vercel 会自动构建并部署应用
   - 部署成功后，记录前端 URL

### 第四步：配置 Composio Gmail 集成

1. **设置 OAuth 回调 URL**
   - 登录 [Composio Dashboard](https://app.composio.dev/)
   - 找到你的 Gmail Auth Config
   - 添加回调 URL：`https://your-app.vercel.app/api/gmail/callback`

2. **验证集成**
   - 访问前端应用
   - 进入 Settings → Gmail
   - 完成 OAuth 流程

### 第五步：验证部署

1. **检查后端健康状态**
   ```bash
   curl https://your-backend.railway.app/health
   # 应返回: {"status": "ok"}
   ```

2. **检查前端**
   - 访问 `https://your-app.vercel.app`
   - 确认页面正常加载
   - 尝试登录/注册

3. **检查数据库连接**
   - 前端和后端都应该能正常连接数据库
   - 检查 Railway 和 Vercel 日志确认无错误

## 环境变量清单

### 必需的环境变量

#### 后端（Railway）
- `OPENROUTER_API_KEY`
- `COMPOSIO_API_KEY`
- `COMPOSIO_GMAIL_AUTH_CONFIG_ID`
- `DATABASE_HOST`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `FRONTEND_URL`
- `NEXT_PUBLIC_PY_BACKEND_URL`

#### 前端（Vercel）
- `BETTER_AUTH_SECRET`（与后端相同）
- `BETTER_AUTH_URL`
- `DATABASE_HOST`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `OPENROUTER_API_KEY`
- `COMPOSIO_API_KEY`
- `COMPOSIO_GMAIL_AUTH_CONFIG_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_PY_BACKEND_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `PY_SERVICE_TOKEN`

### 可选的环境变量

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（用于速率限制）
- `CORS_ALLOW_ORIGINS_RAW`（CORS 配置）
- 各种模型配置（有默认值）

## 常见问题

### 1. 数据库连接失败

**问题**：后端或前端无法连接数据库

**解决方案**：
- 检查数据库是否允许外部连接
- 验证 `DATABASE_HOST`、`DATABASE_USERNAME`、`DATABASE_PASSWORD` 是否正确
- 检查数据库防火墙设置（某些服务需要添加 IP 白名单）

### 2. CORS 错误

**问题**：前端请求后端时出现 CORS 错误

**解决方案**：
- 确保后端 `FRONTEND_URL` 设置为正确的前端 URL
- 检查 `CORS_ALLOW_ORIGINS_RAW` 配置
- 确保前端 `NEXT_PUBLIC_PY_BACKEND_URL` 指向正确的后端 URL

### 3. Gmail OAuth 失败

**问题**：无法连接 Gmail

**解决方案**：
- 检查 Composio 回调 URL 配置
- 确保 `COMPOSIO_API_KEY` 和 `COMPOSIO_GMAIL_AUTH_CONFIG_ID` 正确
- 验证前端 URL 与 Composio 配置一致

### 4. Railway 部署失败

**问题**：Railway 无法启动应用

**解决方案**：
- 检查 `railway.json` 配置
- 确保根目录设置为 `apps/server`
- 查看 Railway 日志了解具体错误
- 确认 `pyproject.toml` 中的依赖正确

### 5. Vercel 构建失败

**问题**：Vercel 构建时出错

**解决方案**：
- 确保根目录设置为 `apps/app`
- 检查所有必需的环境变量是否已设置
- 查看构建日志了解具体错误
- 确认 `package.json` 中的脚本正确

## 监控和维护

### 日志查看

- **Railway**：在项目 Dashboard 中查看实时日志
- **Vercel**：在项目 Dashboard → Functions 中查看日志

### 数据库迁移

当 Schema 变更时：

```bash
# 本地生成迁移
pnpm run db:generate

# 推送变更到数据库
pnpm run db:push
```

### 更新部署

- **自动部署**：如果连接了 GitHub，推送代码会自动触发部署
- **手动部署**：在 Vercel/Railway Dashboard 中点击 "Redeploy"

## 安全建议

1. **环境变量安全**
   - 永远不要将 `.env` 文件提交到 Git
   - 使用强随机字符串作为 `BETTER_AUTH_SECRET`
   - 定期轮换 API 密钥

2. **数据库安全**
   - 使用强密码
   - 限制数据库访问 IP（如果可能）
   - 定期备份数据库

3. **API 安全**
   - 配置正确的 CORS 策略
   - 使用 `PY_SERVICE_TOKEN` 保护后端 API
   - 启用 Rate Limiting（Upstash Redis）

## 成本估算

### Vercel（前端）
- Hobby 计划：免费（适合个人项目）
- Pro 计划：$20/月起（适合团队）

### Railway（后端）
- Starter 计划：$5/月起
- 根据使用量计费

### 数据库
- PlanetScale：免费计划可用
- Railway MySQL：按使用量计费

### 第三方服务
- OpenRouter：按 API 调用计费
- Composio：按使用量计费
- Upstash Redis：免费计划可用

## 下一步

部署完成后：

1. 配置 Gmail 集成（Settings → Gmail）
2. 测试核心功能（聊天、邮件、提醒）
3. 设置监控和告警
4. 配置自定义域名（可选）

## 支持

如遇问题，请查看：
- [项目 README](./README.md)
- [开发指南](./rules/README.md)
- Railway/Vercel 官方文档


