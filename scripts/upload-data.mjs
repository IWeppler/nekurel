// Copies the local data folder (catalog, usage and images) to Supabase.
// Usage: node --env-file=.env.local scripts/upload-data.mjs
// Overwrites the catalog and usage stored in Supabase.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
const directory = process.env.ANKORA_DATA_DIR ? path.resolve(process.env.ANKORA_DATA_DIR) : path.join(process.cwd(), "data");
const auth = { apikey: key, Authorization: `Bearer ${key}` };

async function request(pathname, init) {
  const response = await fetch(`${url}${pathname}`, { ...init, headers: { ...auth, ...init.headers } });
  if (!response.ok) throw new Error(`${pathname}: ${response.status} ${await response.text()}`);
}
async function readJson(name) {
  try { return JSON.parse(await readFile(path.join(directory, name), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

const rows = [];
const catalog = await readJson("catalog.json");
if (catalog) rows.push({ key: "catalog", data: catalog, revision: catalog.revision });
const usage = await readJson("usage.json");
if (usage) rows.push({ key: "usage", data: usage, revision: 0 });
if (rows.length) {
  await request("/rest/v1/app_data?on_conflict=key", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
  console.log(`Subido: ${rows.map(r => r.key).join(", ")}`);
}

const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const images = await readdir(path.join(directory, "images")).catch(() => []);
for (const name of images) {
  const type = types[name.split(".").pop()];
  if (!type) continue;
  await request(`/storage/v1/object/images/${name}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "true" }, body: await readFile(path.join(directory, "images", name)) });
}
console.log(`Imágenes subidas: ${images.length}`);
