import { ImageResponse } from "next/og";

/* Home-screen icon: white N-tilde on the brand green. `maskable` leaves a safe zone for round masks. */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = [180, 192, 512].includes(Number(params.get("size"))) ? Number(params.get("size")) : 192;
  const maskable = params.get("maskable") === "1";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c7a4d", color: "#ffffff", fontSize: size * (maskable ? 0.5 : 0.62), fontWeight: 700, borderRadius: maskable ? 0 : size * 0.22 }}>Ñ</div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
