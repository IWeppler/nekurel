import type { Metadata, Viewport } from "next";
import { Poppins, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

/* Poppins: friendly geometric sans, for titles. Atkinson Hyperlegible: designed for legibility, for everything else. */
const display = Poppins({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-display" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-body" });

export const metadata: Metadata = {
  title: "Ñekurel - Consulta de tónicos",
  description: "Consulta rápida de tónicos, ingredientes, usos y advertencias para el equipo de Ñekurel.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Ñekurel", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon?size=180" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c7a4d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${display.variable} ${body.variable}`}><body>{children}<RegisterServiceWorker /></body></html>;
}
