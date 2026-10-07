import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Ñekurel — Hierbas y preparados, a mano. Ilustración botánica sobre fondo crema.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const background = await readFile(join(process.cwd(), "public", "ingreso-botanico.png"));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5efdf", color: "#233c29", fontFamily: "sans-serif" }}>
      {/* ImageResponse renders an image canvas, so this is intentionally a native img. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${background.toString("base64")}`} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,237,0.15)", display: "flex" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 820, height: 430, borderRadius: 32, background: "rgba(250,247,237,0.92)", border: "1px solid rgba(82,104,63,0.16)" }}>
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none"><path d="M51 12C26 9 12 22 13 37c1 11 13 16 24 11C50 42 52 26 51 12Z" fill="#526b43" /><path d="M17 48 42 23M29 35l-2-13M35 30l12 1" stroke="#f5efdf" strokeWidth="3" strokeLinecap="round" /></svg>
        <div style={{ display: "flex", marginTop: 14, fontSize: 86, fontWeight: 700, letterSpacing: -4, lineHeight: 1.1 }}>Ñekurel</div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 32, color: "#43533a" }}>Hierbas y preparados, a mano.</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 21, color: "#607053" }}>Buscá · Consultá · Compartí</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 18, color: "#6a745f" }}>nekurel.vercel.app</div>
      </div>
    </div>,
    size,
  );
}
