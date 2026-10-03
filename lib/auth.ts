import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const cookieName = "ankora-admin";
export const lifetime = 60 * 60 * 8;
export function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function sign(payload: string) { return createHmac("sha256", process.env.ANKORA_SESSION_SECRET || "").update(payload).digest("hex"); }
export function createSession() { const expiry = String(Date.now() + lifetime * 1000); return `${expiry}.${sign(expiry)}`; }
export async function isAdmin() {
  if (!process.env.ANKORA_ADMIN_PASSWORD || !process.env.ANKORA_SESSION_SECRET) return false;
  const value = (await cookies()).get(cookieName)?.value || "";
  const [expiry, signature] = value.split(".");
  return Boolean(signature && Number(expiry) > Date.now() && equal(signature, sign(expiry)));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const source = new URL(origin);
    return source.host === host && source.protocol === new URL(request.url).protocol;
  } catch { return false; }
}

