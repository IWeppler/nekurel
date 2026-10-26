import { readDocument, rpc } from "./supabase";

export type Usage = Record<string, number>;

function clean(data: unknown): Usage {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(Object.entries(data).filter(([, n]) => Number.isSafeInteger(n) && (n as number) > 0)) as Usage;
}
export async function readUsage(): Promise<Usage> {
  try { return clean(await readDocument("usage")); }
  catch { return {}; }
}
/** Counts one consultation of a tonic. Kept apart from the catalog so it never causes revision conflicts. */
export async function recordUsage(id: string) {
  return clean(await rpc<unknown>("increment_usage", { tonic_id: id }));
}
