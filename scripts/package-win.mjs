import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const publish = process.argv.includes("--publish") ? "always" : "never";
const tempOutput = await mkdtemp(path.join(tmpdir(), "prompt-forge-release-"));
const finalOutput = path.join(rootDir, "release");
const electronBuilderCli = path.join(rootDir, "node_modules", "electron-builder", "cli.js");

try {
  await run(process.execPath, [
    electronBuilderCli,
    "--win",
    "nsis",
    "--x64",
    "--publish",
    publish,
    `--config.directories.output=${tempOutput}`,
  ]);

  await rm(finalOutput, { recursive: true, force: true });
  await mkdir(finalOutput, { recursive: true });

  const entries = await readdir(tempOutput, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isReleaseArtifact(entry.name)) continue;
    await copyFile(path.join(tempOutput, entry.name), path.join(finalOutput, entry.name));
  }

  console.log(`Windows installer artifacts copied to ${finalOutput}`);
} finally {
  await rm(tempOutput, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function isReleaseArtifact(fileName) {
  if (fileName === "builder-debug.yml") return false;
  return fileName.endsWith(".exe") || fileName.endsWith(".blockmap") || fileName.endsWith(".yml");
}
