"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Leaf, MagnifyingGlass, X } from "@phosphor-icons/react";
import { WhatsappIcon } from "@/app/whatsapp-icon";
import { normalize, type Category } from "@/lib/catalog";

export type Product = { id: string; slug: string; name: string; detail: string; price: string; image?: string; tonic: boolean; categoryId: string };

function Photo({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return <div className="product-photo">
    <Leaf size={44} weight="duotone" aria-hidden="true" />
    {product.image && !failed && <Image src={product.image} alt={product.name} width={480} height={480} unoptimized onError={() => setFailed(true)} />}
  </div>;
}

function Card({ product, whatsapp }: { product: Product; whatsapp: string }) {
  const message = `Hola, quiero consultar por ${product.name}${product.price ? ` (${product.price})` : ""}.`;
  return <li className="product">
    <Photo product={product} />
    <div className="product-body">
      <h3><Link className="product-link" href={`/catalogo/${product.slug}`}>{product.name}</Link></h3>
      {product.detail && <p>{product.detail}</p>}
      <div className="product-foot">
        {product.price ? <strong className="product-price">{product.price}</strong> : <span className="product-price is-consult">Consultar</span>}
        {whatsapp && <a className="product-ask no-print" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por ${product.name} por WhatsApp`}><WhatsappIcon size={24} /></a>}
      </div>
    </div>
  </li>;
}

export function Storefront({ products, categories, whatsapp }: { products: Product[]; categories: Category[]; whatsapp: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const q = normalize(query);
  const matches = (p: Product) => (!category || p.categoryId === category) && (!q || normalize(`${p.name} ${p.detail}`).includes(q));
  const shown = products.filter(matches);
  const grouped = !q && !category;
  return <>
    <div className="shop-bar no-print">
      <div className="shop-search">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input type="search" aria-label="Buscar en el catálogo" placeholder="Buscar hierbas o tónicos" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        {query && <button aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={20} aria-hidden="true" /></button>}
      </div>
      <div className="shop-chips" role="group" aria-label="Categorías">
        <button aria-pressed={!category} onClick={() => setCategory("")}>Todo <span>{products.length}</span></button>
        {categories.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(current => current === c.id ? "" : c.id)}>{c.label} <span>{products.filter(p => p.categoryId === c.id).length}</span></button>)}
      </div>
    </div>
    {!shown.length && <div className="shop-empty" role="status">
      <p>{products.length ? `No encontramos productos${query ? ` para “${query}”` : ""}.` : "Todavía no hay productos en el catálogo."}</p>
      {products.length > 0 && <button className="button" onClick={() => { setQuery(""); setCategory(""); }}>Ver todo el catálogo</button>}
    </div>}
    {grouped
      ? categories.map(c => { const list = shown.filter(p => p.categoryId === c.id); return list.length ? <section className="shop-section" key={c.id} aria-labelledby={`cat-${c.id}`}><h2 id={`cat-${c.id}`}>{c.label}</h2><ul className="product-grid">{list.map(p => <Card key={p.id} product={p} whatsapp={whatsapp} />)}</ul></section> : null; })
      : shown.length > 0 && <ul className="product-grid" aria-live="polite">{shown.map(p => <Card key={p.id} product={p} whatsapp={whatsapp} />)}</ul>}
  </>;
}
