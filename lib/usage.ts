import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { directory } from "./store";

const file = path.join(directory, "usage.json");
let queue: Promise<unknown> = Promise.resolve();
export type Usage = Record<string, number>;

export async function readUsage(): Promise<Usage> {
  try {
    const data: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, n]) => Number.isSafeInteger(n) && (n as number) > 0)) as Usage;
  } catch { return {}; }
}
/** Counts one consultation of a tonic. Kept apart from the catalog so it never causes revision conflicts. */
export function recordUsage(id: string) {
  const operation = queue.catch(() => undefined).then(async () => {
    const usage = await readUsage();
    usage[id] = (usage[id] ?? 0) + 1;
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(usage), "utf8");
    await rename(temporary, file);
    return usage;
  });
  queue = operation;
  return operation;
}
