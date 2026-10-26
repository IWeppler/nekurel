import type { Metadata } from "next";
import Image from "next/image";
import { getCategories } from "@/lib/catalog";
import { loadShop } from "@/lib/shop";
import { Storefront, type Product } from "./storefront";
import { ShareButton } from "./share-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo | Ñekurel",
  description: "Hierbas y preparados de Ñekurel con sus precios.",
  openGraph: { title: "Catálogo | Ñekurel", description: "Hierbas y preparados de Ñekurel con sus precios.", url: "/catalogo" },
};

export default async function CatalogPage() {
  let shop;
  try { shop = await loadShop(); } catch (error) {
    console.error("[catalogo] read failed:", error);
    return <main className="shop"><p className="shop-empty" role="alert">No se pudo cargar el catálogo. Intentá de nuevo en unos minutos.</p></main>;
  }
  const products: Product[] = shop.items.map(({ id, slug, name, tonic, image, price, categoryId, summary }) => ({ id, slug, name, tonic, image, price, categoryId, detail: summary }));
  const categories = getCategories(shop.catalog).filter(c => products.some(p => p.categoryId === c.id));
  const date = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  return <main className="shop">
    <header className="shop-head">
      <Image src="/nekurel-logo.png" alt="Ñekurel" width={64} height={64} priority />
      <div className="shop-title"><h1>Catálogo Ñekurel</h1><p>Hierbas y preparados. Precios al {date}.</p></div>
      <ShareButton className="button no-print shop-share" path="/catalogo" text="Catálogo Ñekurel" label="Compartir" />
    </header>
    <Storefront products={products} categories={categories} whatsapp={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? ""} />
    <footer className="shop-foot">Productos de uso tradicional. Consultá antes de usarlos si estás embarazada, en lactancia, tomás medicación o tenés una condición de salud. Precios sujetos a cambios.</footer>
  </main>;
}
