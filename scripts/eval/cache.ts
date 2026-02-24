import { mkdir } from "fs/promises";
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
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${model}:0:${system}:${user}`);
  return hasher.digest("hex").slice(0, 16);
}

export async function readCache(key: string): Promise<CachedResponse | null> {
  try {
    const file = Bun.file(join(CACHE_DIR, `${key}.json`));
    return (await file.json()) as CachedResponse;
  } catch {
    return null;
  }
}

export async function writeCache(
  key: string,
  response: CachedResponse,
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await Bun.write(
    join(CACHE_DIR, `${key}.json`),
    JSON.stringify(response, null, 2),
  );
}
