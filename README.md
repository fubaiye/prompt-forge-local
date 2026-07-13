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

安装包输出在 `release/`，文件名类似 `PromptForge-Setup-0.1.0-x64.exe`。安装版会从 GitHub Releases 检查新版本；右上角出现“更新到 x.y.z”后，点击即可下载并安装更新。

## GitHub Release 发版

仓库推送 `v*` tag 会触发 `.github/workflows/release.yml`：

```bash
npm version patch
git push
git push --tags
```

Actions 会运行测试、构建 Windows 安装包，并把安装包发布到 GitHub Release。安装版和 NAS 部署版都会以最新 GitHub Release 作为更新源。

## NAS 部署

在 NAS 上克隆仓库后：

```bash
npm ci
npm run build
PROMPT_FORGE_HOST=0.0.0.0 PROMPT_FORGE_PORT=8787 npm run start
```

NAS 页面右上角会检查 GitHub Release。要启用“一键自动更新”，给服务进程配置 `PROMPT_FORGE_UPDATE_COMMAND`，例如：

```bash
PROMPT_FORGE_UPDATE_COMMAND="git pull --ff-only && npm ci && npm run build && pm2 restart prompt-forge"
```

如果未配置该变量，点击更新会打开 GitHub Release 页面，避免服务端执行未知命令。

## 本地数据

本地 Provider 和历史记录保存在 `data/*.json` 或安装版用户数据目录中，已被 `.gitignore` 排除，不会提交到 GitHub。
