import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(join(process.cwd(), ".github", "workflows", "release.yml"), "utf8");

describe("release workflow", () => {
  it("publishes NAS Docker image tar files for amd64 and arm64", () => {
    expect(releaseWorkflow).toContain("docker/setup-qemu-action");
    expect(releaseWorkflow).toContain("linux/amd64");
    expect(releaseWorkflow).toContain("linux/arm64");
    expect(releaseWorkflow).toContain("linux-amd64.tar");
    expect(releaseWorkflow).toContain("linux-arm64.tar");
  });
});
