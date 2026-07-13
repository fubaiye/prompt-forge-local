import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { describe, expect, it, vi } from "vitest";
import { createUpdateRouter } from "../../server/src/routes/update";

describe("update route", () => {
  it("reports a newer GitHub release", async () => {
    const fetchLatestRelease = vi.fn(async () => ({
      tag_name: "v0.2.0",
      html_url: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
      name: "v0.2.0",
    }));

    const app = express();
    app.use(express.json());
    app.use(
      "/api/update",
      createUpdateRouter({
        currentVersion: "0.1.0",
        repository: "fubaiye/prompt-forge-local",
        fetchLatestRelease,
      }),
    );

    const response = await requestJson(app, "/api/update/check", "GET");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      currentVersion: "0.1.0",
      latestVersion: "0.2.0",
      updateAvailable: true,
      releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
    });
    expect(fetchLatestRelease).toHaveBeenCalledWith("fubaiye/prompt-forge-local");
  });

  it("returns a manual update action when NAS auto command is not configured", async () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api/update",
      createUpdateRouter({
        currentVersion: "0.1.0",
        repository: "fubaiye/prompt-forge-local",
        fetchLatestRelease: async () => ({
          tag_name: "v0.2.0",
          html_url: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
        }),
      }),
    );

    const response = await requestJson(app, "/api/update/apply", "POST");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "manual",
      releaseUrl: "https://github.com/fubaiye/prompt-forge-local/releases/tag/v0.2.0",
    });
  });
});

async function requestJson(app: Express, path: string, method: "GET" | "POST"): Promise<{ status: number; body: any }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    return await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text ? JSON.parse(text) : null,
            });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
