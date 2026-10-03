import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedCatalog, validateCatalog, type Catalog } from "./catalog";

export const directory = process.env.ANKORA_DATA_DIR ? path.resolve(/* turbopackIgnore: true */ process.env.ANKORA_DATA_DIR) : path.join(process.cwd(), "data");
const file = path.join(directory, "catalog.json");
let queue: Promise<unknown> = Promise.resolve();
export class ConflictError extends Error {}
export async function readCatalog(): Promise<Catalog> {
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
  const operation = queue.catch(() => undefined).then(async () => {
    validateCatalog(data);
    const current = await readCatalog();
    if (current.revision !== data.revision) throw new ConflictError("Otra persona modificó el catálogo. Recargá antes de guardar.");
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

