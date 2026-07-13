import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface JsonFileStore<T> {
  read(): Promise<T>;
  write(value: T): Promise<void>;
}

export function createJsonFileStore<T>(filePath: string, fallback: T): JsonFileStore<T> {
  return {
    async read() {
      try {
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content) as T;
      } catch (error) {
        if (isMissingFileError(error) || error instanceof SyntaxError) {
          return structuredClone(fallback);
        }
        throw error;
      }
    },

    async write(value) {
      await mkdir(dirname(filePath), { recursive: true });
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await rename(tempPath, filePath);
    },
  };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
