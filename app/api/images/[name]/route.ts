import { readFile } from "node:fs/promises";
import path from "node:path";
import { directory } from "@/lib/store";
import { imageTypes, validImageName } from "@/lib/images";
import { supabase, supabaseEnabled } from "@/lib/supabase";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!validImageName(name)) return new Response("Imagen no encontrada", { status: 404 });
  try {
    const bytes = supabaseEnabled ? await storedImage(name) : await readFile(path.join(directory, "images", name));
    const extension = name.split(".").pop() as keyof typeof imageTypes;
    return new Response(bytes, { headers: { "Content-Type": imageTypes[extension], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Imagen no encontrada", { status: 404 }); }
}
async function storedImage(name: string) {
  const response = await supabase(`/storage/v1/object/images/${name}`);
  if (!response.ok) throw new Error("Imagen no encontrada");
  return new Uint8Array(await response.arrayBuffer());
}
