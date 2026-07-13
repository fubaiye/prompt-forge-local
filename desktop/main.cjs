const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");

const GITHUB_REPOSITORY = "fubaiye/prompt-forge-local";
let mainWindow;
let serverInstance;
let lastUpdateStatus = {
  currentVersion: app.getVersion(),
  updateAvailable: false,
  releaseUrl: `https://github.com/${GITHUB_REPOSITORY}/releases/latest`,
};

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateStatus(payload) {
  lastUpdateStatus = {
    currentVersion: app.getVersion(),
    releaseUrl: `https://github.com/${GITHUB_REPOSITORY}/releases/latest`,
    ...payload,
  };
  mainWindow?.webContents.send("updater:status", lastUpdateStatus);
  return lastUpdateStatus;
}

autoUpdater.on("update-available", (info) => {
  sendUpdateStatus({
    latestVersion: info.version,
    updateAvailable: isNewerVersion(info.version, app.getVersion()),
    message: `发现新版本 ${info.version}`,
  });
});

autoUpdater.on("update-not-available", (info) => {
  sendUpdateStatus({
    latestVersion: info.version,
    updateAvailable: false,
    message: "当前已经是最新版本",
  });
});

autoUpdater.on("download-progress", (progress) => {
  sendUpdateStatus({
    ...lastUpdateStatus,
    updateAvailable: true,
    message: `正在下载 ${Math.round(progress.percent)}%`,
  });
});

autoUpdater.on("update-downloaded", (info) => {
  sendUpdateStatus({
    latestVersion: info.version,
    updateAvailable: true,
    message: "更新已下载，准备安装",
  });
});

autoUpdater.on("error", (error) => {
  sendUpdateStatus({
    ...lastUpdateStatus,
    updateAvailable: false,
    message: error instanceof Error ? error.message : "检查更新失败",
  });
});

ipcMain.handle("updater:check", async () => {
  if (!app.isPackaged) {
    return sendUpdateStatus({
      updateAvailable: false,
      message: "开发模式不检查安装包更新",
    });
  }

  const result = await autoUpdater.checkForUpdates();
  const info = result?.updateInfo;
  return sendUpdateStatus({
    latestVersion: info?.version,
    updateAvailable: info?.version ? isNewerVersion(info.version, app.getVersion()) : false,
    message: info?.version ? `最新版本 ${info.version}` : "",
  });
});

ipcMain.handle("updater:download", async () => {
  if (!lastUpdateStatus.updateAvailable) return lastUpdateStatus;
  await autoUpdater.downloadUpdate();
  return lastUpdateStatus;
});

ipcMain.handle("updater:install", async () => {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
});

async function startLocalServer() {
  const appRoot = app.getAppPath();
  const dataDir = path.join(app.getPath("userData"), "data");
  const clientDist = path.join(appRoot, "dist");
  const serverEntry = path.join(appRoot, "build", "server", "index.mjs");

  process.env.PROMPT_FORGE_DATA_DIR = dataDir;
  process.env.PROMPT_FORGE_CLIENT_DIST = clientDist;
  process.env.PROMPT_FORGE_VERSION = app.getVersion();
  process.env.PROMPT_FORGE_GITHUB_REPO = GITHUB_REPOSITORY;

  const serverModule = await import(pathToFileURL(serverEntry).href);
  serverInstance = await serverModule.startServer({
    host: "127.0.0.1",
    port: 0,
    dataDir,
    clientDist,
  });
  return serverInstance.url;
}

async function createWindow() {
  const appUrl = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    title: "提示词工坊",
    backgroundColor: "#09090d",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(appUrl);
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    dialog.showErrorBox("启动失败", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverInstance?.server.close();
});

function isNewerVersion(latestVersion, currentVersion) {
  return compareVersions(latestVersion, currentVersion) > 0;
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }

  return 0;
}

function normalizeVersion(version) {
  const clean = String(version || "0.0.0").trim().replace(/^v/i, "").split("-")[0];
  const parts = clean.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
