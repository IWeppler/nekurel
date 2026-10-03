import { cookies } from "next/headers";
import { cookieName, lifetime, equal, createSession, isAdmin, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET() { return Response.json({ admin: await isAdmin() }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!process.env.ANKORA_ADMIN_PASSWORD || !process.env.ANKORA_SESSION_SECRET) return Response.json({ error: "Configurá el acceso de administración en el servidor." }, { status: 503 });
  const key = "local";
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 10) return Response.json({ error: "Demasiados intentos. Volvé a intentar en 15 minutos." }, { status: 429 });
  let password: unknown;
  try { if (Number(request.headers.get("content-length")) > 4096) throw new Error(); password = (await request.json()).password; } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (typeof password !== "string" || password.length > 512 || !equal(password, process.env.ANKORA_ADMIN_PASSWORD)) {
    attempts.set(key, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 900000 });
    return Response.json({ error: "La contraseña no es correcta." }, { status: 401 });
  }
  attempts.delete(key);
  (await cookies()).set(cookieName, createSession(), { httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: lifetime });
  return Response.json({ admin: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  (await cookies()).delete(cookieName);
  return Response.json({ admin: false });
}
