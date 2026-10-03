import { isAdmin, sameOrigin } from "@/lib/auth";
import { readCatalog, saveCatalog, ConflictError } from "@/lib/store";
import { searchCatalog, validateCatalog } from "@/lib/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const catalog = await readCatalog();
    if (await isAdmin()) return Response.json(catalog, { headers: { "Cache-Control": "no-store" } });
    const visible = searchCatalog(catalog, "");
    return Response.json({ ...visible, revision: catalog.revision }, { headers: { "Cache-Control": "no-store", "X-Catalog-Scope": "public" } });
  } catch { return Response.json({ error: "No se pudo leer el catálogo. Revisá el archivo del servidor." }, { status: 500 }); }
}
export async function PUT(request: Request) {
  if (!sameOrigin(request) || !await isAdmin()) return Response.json({ error: "Ingresá como administrador para guardar." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 2_000_000) return Response.json({ error: "El catálogo es demasiado grande." }, { status: 413 });
    const data: unknown = JSON.parse(text);
    validateCatalog(data);
    return Response.json(await saveCatalog(data));
  } catch (error) {
    if (error instanceof ConflictError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof SyntaxError || (error instanceof Error && !("code" in error))) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "No se pudo guardar. Tus cambios siguen en el formulario; intentá nuevamente." }, { status: 500 });
  }
}
