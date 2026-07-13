export function normalizeVersion(version: string): [number, number, number] {
  const clean = version.trim().replace(/^v/i, "").split("-")[0];
  const parts = clean.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }

  return 0;
}

export function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  return compareVersions(latestVersion, currentVersion) === 1;
}
