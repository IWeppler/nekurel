import { seedCatalog, validateCatalog, type Catalog } from "./catalog";
import { readDocument, rpc } from "./supabase";

export class ConflictError extends Error {}
const conflict = () => new ConflictError("Otra persona modificó el catálogo. Recargá antes de guardar.");
export async function readCatalog(): Promise<Catalog> {
  const data = await readDocument("catalog");
  if (data === null) return structuredClone(seedCatalog);
  validateCatalog(data);
  return data;
}
export async function saveCatalog(data: Catalog) {
  validateCatalog(data);
  const current = await readCatalog();
  if (current.revision !== data.revision) throw conflict();
  // save_catalog compares the revision and writes in one statement, so concurrent saves cannot overwrite each other.
  const next = await rpc<Catalog | null>("save_catalog", { expected: data.revision, payload: { ...data, revision: data.revision + 1 } });
  if (!next) throw conflict();
  return next;
}
