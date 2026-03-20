# 设备管理中心 - Web 控制台

基于 Cloudflare Pages 的 Web 远程控制面板，配合桌面应用「设备管理中心」使用。

## 架构

```
浏览器 (Cloudflare Pages)
    ↕ HTTPS
Cloudflare Workers (API + KV)
    ↕ HTTPS 轮询
桌面应用 (Tauri)
    ↕ SSH
远程 Ubuntu 设备
```

## 功能

- Repo 同步 / 强制同步
- Gerrit Cherry-Pick
- 编译构建
- 自定义命令
- Jenkins 重建
- 命令历史查看
- 工作区管理

## 部署

### 1. 创建 Cloudflare Pages 项目

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 KV 命名空间
npx wrangler kv namespace create COMMANDS
npx wrangler kv namespace create SYNC_DATA

# 更新 wrangler.toml 中的 KV ID
```

### 2. 连接 GitHub

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 中选择 Pages
2. 点击 "Create a project" → "Connect to Git"
3. 选择此仓库
4. 构建设置:
   - 框架: None
   - 构建命令: 留空
   - 输出目录: `.`
5. 环境变量:
   - `API_KEY`: 设置一个安全的 API 密钥（与桌面应用配置相同）

### 3. 绑定 KV

在 Pages 项目的 Settings → Functions → KV namespace bindings 中:
- `COMMANDS` → 选择 COMMANDS 命名空间
- `SYNC_DATA` → 选择 SYNC_DATA 命名空间

### 4. 配置桌面应用

在桌面应用设置中配置:
- Web 触发器 API 地址: `https://your-project.pages.dev/api`
- API 密钥: 与 Cloudflare 环境变量中设置的相同

## 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:8788

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/commands | 获取命令列表 |
| GET | /api/commands?poll=true | 轮询待执行命令（桌面应用用） |
| POST | /api/commands | 创建新命令 |
| PUT | /api/commands/:id | 更新命令状态 |
| GET | /api/workspaces | 获取工作区列表 |
| POST | /api/workspaces | 同步/添加工作区 |
