import type { Metadata, Viewport } from "next";
import { Poppins, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

/* Poppins: friendly geometric sans, for titles. Atkinson Hyperlegible: designed for legibility, for everything else. */
const display = Poppins({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-display" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-body" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nekurel.vercel.app";
const title = "Ñekurel | Hierbas y preparados";
const description = "Encontrá hierbas y preparados de la casa. Consultá sus usos tradicionales, ingredientes y advertencias, y compartí la receta.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, siteName: "Ñekurel", locale: "es_AR", type: "website", url: "/" },
  twitter: { card: "summary_large_image", title, description, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Ñekurel — Hierbas y preparados, a mano." }] },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Ñekurel", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon?size=180" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c7a4d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${display.variable} ${body.variable}`}><body>{children}<RegisterServiceWorker /></body></html>;
}

