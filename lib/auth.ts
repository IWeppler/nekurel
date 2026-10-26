import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const cookieName = "ankora-admin";
export const lifetime = 60 * 60 * 8;
/** Sellers use a shared code once per device (the shop's tablet), so their session lasts longer. */
export const sellerCookieName = "nekurel-seller";
export const sellerLifetime = 60 * 60 * 24 * 30;
export function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function sign(payload: string) { return createHmac("sha256", process.env.ANKORA_SESSION_SECRET || "").update(payload).digest("hex"); }
// The seller signature covers a different payload, so a seller cookie can never pass as an administrator one.
// It includes the code, so changing ANKORA_SELLER_CODE signs every seller out (for example, when someone leaves the team).
const sellerPayload = (expiry: string) => `seller:${process.env.ANKORA_SELLER_CODE}:${expiry}`;
export function createSession() { const expiry = String(Date.now() + lifetime * 1000); return `${expiry}.${sign(expiry)}`; }
export function createSellerSession() { const expiry = String(Date.now() + sellerLifetime * 1000); return `${expiry}.${sign(sellerPayload(expiry))}`; }
function valid(value: string, payload: (expiry: string) => string) {
  const [expiry, signature] = value.split(".");
  return Boolean(signature && Number(expiry) > Date.now() && equal(signature, sign(payload(expiry))));
}
export async function isAdmin() {
  if (!process.env.ANKORA_ADMIN_PASSWORD || !process.env.ANKORA_SESSION_SECRET) return false;
  return valid((await cookies()).get(cookieName)?.value || "", expiry => expiry);
}
/** Sellers and administrators can read the full catalogue, which includes internal notes and recipes. */
export async function isSeller() {
  if (await isAdmin()) return true;
  if (!process.env.ANKORA_SELLER_CODE || !process.env.ANKORA_SESSION_SECRET) return false;
  return valid((await cookies()).get(sellerCookieName)?.value || "", sellerPayload);
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
