import { isSeller, sameOrigin } from "@/lib/auth";
import { readCatalog } from "@/lib/store";
import { readUsage, recordUsage } from "@/lib/usage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Consultation counts are internal team data: sellers and administrators only.
export async function GET() {
  if (!await isSeller()) return Response.json({}, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json(await readUsage(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await isSeller()) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    const catalog = await readCatalog();
    if (typeof id !== "string" || !catalog.preparations.some(p => p.id === id && p.published)) return Response.json({ error: "Tónico inválido." }, { status: 400 });
    return Response.json(await recordUsage(id));
  } catch { return Response.json({ error: "No se pudo registrar." }, { status: 400 }); }
}
