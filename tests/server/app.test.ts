import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("server app", () => {
  it("mounts the update check endpoint", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "prompt-forge-"));
    const app = createApp({
      dataDir: tempDir,
      update: {
        currentVersion: "0.1.0",
        repository: "fubaiye/prompt-forge-local",
        fetchLatestRelease: async () => ({
          tag_name: "v0.2.0",
          html_url: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
        }),
      },
    });

    const response = await requestJson(app, "/api/update/check");

    expect(response.status).toBe(200);
    expect(response.body.updateAvailable).toBe(true);
    expect(response.body.latestVersion).toBe("0.2.0");
  });
});

async function requestJson(app: Express, path: string): Promise<{ status: number; body: any }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    return await new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            body: text ? JSON.parse(text) : null,
          });
        });
      });
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
