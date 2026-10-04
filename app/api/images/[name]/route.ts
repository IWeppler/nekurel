import { readFile } from "node:fs/promises";
import path from "node:path";
import { directory } from "@/lib/store";
import { imageTypes, validImageName } from "@/lib/images";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!validImageName(name)) return new Response("Imagen no encontrada", { status: 404 });
  try {
    const bytes = await readFile(path.join(directory, "images", name));
    const extension = name.split(".").pop() as keyof typeof imageTypes;
    return new Response(bytes, { headers: { "Content-Type": imageTypes[extension], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Imagen no encontrada", { status: 404 }); }
}
