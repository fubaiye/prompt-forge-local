# 提示词工坊

本地 AI System Prompt 生成工作台。支持 OpenAI-Compatible API Provider、自定义调用模型、模型能力选择、历史版本，以及 GitHub Release 更新提示。

## 本地开发

```bash
npm ci
npm run dev
```

前端默认运行在 `http://127.0.0.1:5173/`，API 服务默认运行在 `http://127.0.0.1:8787/`。

## 生产构建

```bash
npm run build
npm run start
```

`npm run start` 会从 `dist/` 提供前端页面，同时提供 `/api/*` 接口。

## Windows 安装包

```bash
npm run pack:win
```

安装包输出在 `release/`，文件名类似 `PromptForge-Setup-0.1.1-x64.exe`。安装版会从 GitHub Releases 检查新版本；右上角出现“更新到 x.y.z”后，点击即可下载并安装更新。

## NAS Docker 部署

适合群晖 DSM 的 Container Manager，或者任意支持 Docker Compose 的 NAS。

1. 在 NAS 文件管理器里进入共享文件夹的 `docker` 目录。
2. 如果已经有 `prompt-forge` 文件夹，进入它；如果没有，新建一个。
3. 在 Container Manager 里创建项目，存放路径选择 `共享文件夹/docker/prompt-forge`。
4. 如果不想 SSH 或拉源码，在 Compose 配置里直接粘贴：

```yaml
services:
  prompt-forge:
    image: ghcr.io/fubaiye/prompt-forge-local:latest
    container_name: prompt-forge
    user: "0:0"
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      PROMPT_FORGE_HOST: 0.0.0.0
      PROMPT_FORGE_PORT: 8787
      PROMPT_FORGE_DATA_DIR: /app/data
      PROMPT_FORGE_CLIENT_DIST: /app/dist
      PROMPT_FORGE_GITHUB_REPO: fubaiye/prompt-forge-local
      PROMPT_FORGE_UPDATE_WEBHOOK_URL: http://prompt-forge-updater:8080/v1/update
      PROMPT_FORGE_UPDATE_WEBHOOK_TOKEN: prompt-forge-nas-update
    volumes:
      - ./data:/app/data
    labels:
      com.centurylinklabs.watchtower.enable: "true"

  prompt-forge-updater:
    image: ghcr.io/nicholas-fedor/watchtower:latest
    container_name: prompt-forge-updater
    user: "0:0"
    restart: unless-stopped
    environment:
      WATCHTOWER_HTTP_API_UPDATE: "true"
      WATCHTOWER_HTTP_API_TOKEN: prompt-forge-nas-update
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_CLEANUP: "true"
      WATCHTOWER_NO_STARTUP_MESSAGE: "true"
      WATCHTOWER_LOG_LEVEL: debug
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    labels:
      com.centurylinklabs.watchtower.enable: "false"
```

5. 点“立即部署”。
6. 浏览器打开：

```text
http://你的NAS局域网IP:8787
```

数据会保存在 NAS 的 `prompt-forge/data` 目录里，包括 API Provider 和历史记录。该目录不会提交到 GitHub。

`user: "0:0"` 是为了兼容群晖/绿联等 NAS 对共享文件夹挂载目录的权限处理，避免保存 API Provider 时出现 `/app/data/providers.json.tmp` permission denied。

### Docker 版更新

右上角会检查 GitHub Release 并提示有新版本。使用上面的 NAS Compose 时，点击更新会调用 `prompt-forge-updater`，由 Watchtower 拉取 `ghcr.io/fubaiye/prompt-forge-local:latest` 并重启 `prompt-forge` 容器。

如果 Watchtower 服务被你删掉，仍然可以在 Container Manager 里重建项目，或者用 SSH 执行：

```bash
cd /volume1/docker/prompt-forge
git pull --ff-only
docker compose up -d --build
```

使用 `docker-compose.nas.yml` 时不需要源码；使用 `docker-compose.yml` 时会在 NAS 本地构建镜像。

## NAS PM2 部署

如果你希望右上角点击更新后由服务端自动执行更新命令，推荐用 PM2 裸机部署：

```bash
cd /volume1/docker/prompt-forge
npm ci
npm run build
npm install -g pm2
PROMPT_FORGE_HOST=0.0.0.0 PROMPT_FORGE_PORT=8787 PROMPT_FORGE_UPDATE_COMMAND="git pull --ff-only && npm ci && npm run build && pm2 restart prompt-forge" pm2 start build/server/index.mjs --name prompt-forge
pm2 save
```

未配置 `PROMPT_FORGE_UPDATE_COMMAND` 时，点击更新会打开 GitHub Release 页面，避免服务端执行未知命令。

## GitHub Release 发版

仓库推送 `v*` tag 会触发 `.github/workflows/release.yml`：

```bash
npm version patch
git push
git push --tags
```

Actions 会运行测试、构建 Windows 安装包，并把安装包发布到 GitHub Release。安装版和 NAS 部署版都会以最新 GitHub Release 作为更新源。

## 本地数据

本地 Provider 和历史记录保存在 `data/*.json` 或安装版用户数据目录中，已被 `.gitignore` 排除，不会提交到 GitHub。
