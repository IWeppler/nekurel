import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { directory } from "@/lib/store";
import { imageFormat, imageTypes, maxImageBytes } from "@/lib/images";

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
    const folder = path.join(directory, "images");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, name), bytes, { flag: "wx" });
    return Response.json({ image: `/api/images/${name}` }, { status: 201 });
  } catch (error) {
    const filesystemError = error instanceof Error && "code" in error;
    return Response.json({ error: filesystemError ? "No se pudo guardar la imagen. Intentá nuevamente." : "No se pudo leer el archivo de imagen." }, { status: filesystemError ? 500 : 400 });
  }
}
