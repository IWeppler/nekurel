import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedCatalog, validateCatalog, type Catalog } from "./catalog";
import { readDocument, rpc, supabaseEnabled } from "./supabase";

export const directory = process.env.ANKORA_DATA_DIR ? path.resolve(/* turbopackIgnore: true */ process.env.ANKORA_DATA_DIR) : path.join(process.cwd(), "data");
const file = path.join(directory, "catalog.json");
let queue: Promise<unknown> = Promise.resolve();
export class ConflictError extends Error {}
const conflict = () => new ConflictError("Otra persona modificó el catálogo. Recargá antes de guardar.");
export async function readCatalog(): Promise<Catalog> {
  if (supabaseEnabled) {
    const data = await readDocument("catalog");
    if (data === null) return structuredClone(seedCatalog);
    validateCatalog(data);
    return data;
  }
  try {
    const data: unknown = JSON.parse(await readFile(file, "utf8"));
    validateCatalog(data);
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(seedCatalog);
    throw error;
  }
}
export async function saveCatalog(data: Catalog) {
  validateCatalog(data);
  if (supabaseEnabled) {
    // save_catalog compares the revision and writes in one statement, so concurrent instances cannot overwrite each other.
    const current = await readCatalog();
    if (current.revision !== data.revision) throw conflict();
    const next = await rpc<Catalog | null>("save_catalog", { expected: data.revision, payload: { ...data, revision: data.revision + 1 } });
    if (!next) throw conflict();
    return next;
  }
  const operation = queue.catch(() => undefined).then(async () => {
    const current = await readCatalog();
    if (current.revision !== data.revision) throw conflict();
    const next = { ...data, revision: current.revision + 1 };
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(next, null, 2), "utf8");
    await rename(temporary, file);
    return next;
  });
  queue = operation;
  return operation;
}
