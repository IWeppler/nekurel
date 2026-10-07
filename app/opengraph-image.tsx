import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Ñekurel Herboristería — Julio A. Roca 625, Tostado, Santa Fe.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "nekurel-logo.png"));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102b20" }}>
      {/* ImageResponse requires a native image; preserve the entire supplied artwork. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} width={788} height={630} alt="" style={{ objectFit: "contain" }} />
    </div>,
    size,
  );
}