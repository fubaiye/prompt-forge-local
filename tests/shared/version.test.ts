import { describe, expect, it } from "vitest";
import { compareVersions, isNewerVersion, normalizeVersion } from "../../shared/version";

describe("version helpers", () => {
  it("normalizes release tags before comparison", () => {
    expect(normalizeVersion("v0.2.0")).toEqual([0, 2, 0]);
    expect(normalizeVersion("1.4.3-beta.2")).toEqual([1, 4, 3]);
  });

  it("detects newer semantic versions", () => {
    expect(compareVersions("v0.2.0", "0.1.9")).toBe(1);
    expect(compareVersions("0.1.0", "v0.1.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
    expect(isNewerVersion("v0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("v0.1.0", "0.1.0")).toBe(false);
  });
});
