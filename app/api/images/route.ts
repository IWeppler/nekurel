import { randomUUID } from "node:crypto";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { imageFormat, imageTypes, maxImageBytes } from "@/lib/images";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await isAdmin()) return Response.json({ error: "Ingresá como administrador para subir imágenes." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > maxImageBytes + 65536) return Response.json({ error: "La imagen debe pesar menos de 5 MB." }, { status: 413 });
  try {
    const file = (await request.formData()).get("image");
    if (!(file instanceof File) || !file.size || file.size > maxImageBytes) return Response.json({ error: "Elegí una imagen de hasta 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = imageFormat(bytes);
    if (!format || file.type !== imageTypes[format]) return Response.json({ error: "La imagen debe ser JPG, PNG o WebP." }, { status: 400 });
    const name = `${randomUUID()}.${format}`;
    await supabase(`/storage/v1/object/images/${name}`, { method: "POST", headers: { "Content-Type": imageTypes[format] }, body: bytes });
    return Response.json({ image: `/api/images/${name}` }, { status: 201 });
  } catch (error) {
    const storageError = error instanceof Error && "code" in error;
    if (storageError) console.error(error);
    return Response.json({ error: storageError ? "No se pudo guardar la imagen. Intentá nuevamente." : "No se pudo leer el archivo de imagen." }, { status: storageError ? 500 : 400 });
  }
}
