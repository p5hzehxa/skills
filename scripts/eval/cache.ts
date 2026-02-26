import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { TokenUsage } from "./types.ts";

const CACHE_DIR = join(process.cwd(), "scripts", "output", "eval-cache");

export interface CachedResponse {
  output: string;
  usage: TokenUsage;
  model: string;
  cachedAt: string;
}

export function getCacheKey(
  model: string,
  system: string,
  user: string,
): string {
  return createHash("sha256")
    .update(`${model}:0:${system}:${user}`)
    .digest("hex")
    .slice(0, 16);
}

export async function readCache(key: string): Promise<CachedResponse | null> {
  try {
    const data = await readFile(join(CACHE_DIR, `${key}.json`), "utf8");
    return JSON.parse(data) as CachedResponse;
  } catch {
    return null;
  }
}

export async function writeCache(
  key: string,
  response: CachedResponse,
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    join(CACHE_DIR, `${key}.json`),
    JSON.stringify(response, null, 2),
  );
}
