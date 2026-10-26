import { cookies } from "next/headers";
import { cookieName, lifetime, sellerCookieName, sellerLifetime, equal, createSession, createSellerSession, isAdmin, isSeller, sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET() { return Response.json({ admin: await isAdmin(), seller: await isSeller() }, { headers: { "Cache-Control": "no-store" } }); }
/** `{ password }` opens an administrator session; `{ code }` opens a seller session. Both share the attempt limit. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  let body: { password?: unknown; code?: unknown };
  try { if (Number(request.headers.get("content-length")) > 4096) throw new Error(); body = await request.json(); } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
  const seller = body && typeof body === "object" && "code" in body;
  const expected = seller ? process.env.ANKORA_SELLER_CODE : process.env.ANKORA_ADMIN_PASSWORD;
  if (!expected || !process.env.ANKORA_SESSION_SECRET) return Response.json({ error: seller ? "Configurá el código de vendedor en el servidor (ANKORA_SELLER_CODE)." : "Configurá el acceso de administración en el servidor." }, { status: 503 });
  const key = "local";
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 10) return Response.json({ error: "Demasiados intentos. Volvé a intentar en 15 minutos." }, { status: 429 });
  const secret = seller ? body.code : body.password;
  if (typeof secret !== "string" || secret.length > 512 || !equal(secret, expected)) {
    attempts.set(key, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 900000 });
    return Response.json({ error: seller ? "El código no es correcto." : "La contraseña no es correcta." }, { status: 401 });
  }
  attempts.delete(key);
  const secure = new URL(request.url).protocol === "https:";
  if (seller) (await cookies()).set(sellerCookieName, createSellerSession(), { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: sellerLifetime });
  else (await cookies()).set(cookieName, createSession(), { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: lifetime });
  return Response.json(seller ? { seller: true } : { admin: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  (await cookies()).delete(cookieName);
  return Response.json({ admin: false });
}
