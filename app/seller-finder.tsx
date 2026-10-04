"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Leaf, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import { CatalogImage } from "./catalog-image";
import { avoidOptions, normalize, type Catalog, type Plant, type Preparation } from "@/lib/catalog";

type Props = {
  selectedId?: string; catalog: Catalog | null; query: string; onQuery: (query: string) => void;
  results: Preparation[]; herbs: Plant[]; onOpenHerb: (plant: Plant) => void;
  suggestions: string[]; plantName: (id: string) => string;
  isDraft: (id: string) => boolean; onOpen: (prep: Preparation) => void;
  profile: string[]; onProfile: (value: string[]) => void; topIds: Set<string>; onExit: () => void;
};
const categories = [
  { id: "mate", label: "Mate", query: "mate", kind: "herbs" as const, position: "0%" },
  { id: "herbs", label: "Hierbas", query: "", kind: "herbs" as const, position: "100%" },
  { id: "tonics", label: "Tónicos", query: "", kind: "tonics" as const, position: "50%" },
];
const avoidLabel = (id: string) => avoidOptions.find(o => o.id === id)?.label ?? id;

function Thumbnail({ image, name, tonic = false }: { image?: string; name: string; tonic?: boolean }) {
  return <span className={`catalog-thumb${tonic ? " tonic-thumb" : ""}`}><Leaf size={25} weight={tonic ? "duotone" : "regular"} aria-hidden="true" /><CatalogImage image={image} name={name} /></span>;
}

export function Finder({ catalog, query, onQuery, results, herbs, onOpenHerb, suggestions, plantName, isDraft, onOpen, profile, onProfile, topIds, onExit, selectedId }: Props) {
  const [kind, setKind] = useState<"all" | "tonics" | "herbs">("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const searching = query.trim().length > 0;
  const preparations = kind === "herbs" ? [] : results;
  const plants = kind === "tonics" ? [] : herbs;
  const mostConsulted = (catalog?.preparations ?? []).filter(p => p.published && topIds.has(p.id)).slice(0, 6);
  const quickSearches = [...new Set(["Manzanilla", "Menta", "Cedrón", ...suggestions])].slice(0, 8);
  const updateQuery = (value: string) => { onQuery(value); setSelectedCategory(""); };
  const toggleProfile = (id: string) => onProfile(profile.includes(id) ? profile.filter(p => p !== id) : [...profile, id]);
  return <section className="seller-finder">
    <div className="seller-return"><button aria-label="Volver a seleccionar rol" onClick={onExit}><ArrowLeft size={22} aria-hidden="true" />Volver</button></div>
    <div className="seller-search"><MagnifyingGlass size={37} weight="regular" aria-hidden="true" /><input type="search" aria-label="Buscar hierbas, tónicos o usos" placeholder="Buscar" value={query} onChange={e => updateQuery(e.target.value)} inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} />{query && <button className="search-reset" aria-label="Borrar búsqueda" onClick={() => updateQuery("")}><X size={24} aria-hidden="true" /></button>}</div>

    {!searching && <><section className="seller-section"><h2>Categorías</h2><div className="category-strip">{categories.map(category => {
      const custom = category.id === "tonics" ? catalog?.preparations.find(p => p.published && p.image)?.image : catalog?.plants.find(p => p.image && (category.id !== "mate" || [...p.uses, ...p.aliases].some(term => normalize(term).includes("mate"))))?.image;
      return <button className={`category-tile category-${category.id}`} key={category.id} aria-pressed={selectedCategory === category.id} onClick={() => { setKind(category.kind); setSelectedCategory(category.id); onQuery(category.query); }}>
        {custom ? <CatalogImage image={custom} name="" className="category-photo" /> : <span className="category-photo category-fallback" style={{ backgroundPosition: `${category.position} center` }} aria-hidden="true" />}
        <span className="category-label">{category.label}</span><span className="category-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </button>;
    })}</div></section>
    <section className="seller-section quick-section"><h2>{mostConsulted.length ? "Más consultados" : "Búsquedas rápidas"}</h2><div className="quick-chips">{mostConsulted.length ? mostConsulted.map(prep => <button key={prep.id} onClick={() => onOpen(prep)}><Thumbnail image={prep.image} name="" tonic /><span>{prep.name}</span></button>) : quickSearches.map(term => {
      const plant = catalog?.plants.find(p => normalize(p.name) === normalize(term));
      return <button key={term} onClick={() => { setKind("all"); updateQuery(term); }}><Thumbnail image={plant?.image} name="" /><span>{term}</span></button>;
    })}</div></section></>}

    <section className="seller-section seller-catalog"><div className="catalog-heading"><h2>{searching ? "Resultados" : "Catálogo"}</h2><div className="catalog-kinds" role="group" aria-label="Tipo de resultado">{([{ id: "all", label: "Todo" }, { id: "tonics", label: "Tónicos" }, { id: "herbs", label: "Hierbas" }] as const).map(option => <button key={option.id} aria-pressed={kind === option.id} onClick={() => { setKind(option.id); setSelectedCategory(""); }}>{option.label}</button>)}</div></div>
      <section className="seller-profile" aria-labelledby="customer-profile-title"><h3 id="customer-profile-title">Situación del cliente</h3><div className="profile" role="group" aria-label="Situación del cliente">{avoidOptions.map(option => <button key={option.id} className="chip small" aria-pressed={profile.includes(option.id)} onClick={() => toggleProfile(option.id)}>{profile.includes(option.id) && <Check size={18} weight="bold" aria-hidden="true" />}{option.label}</button>)}</div></section>
      <div className="seller-results" aria-live="polite" aria-busy={!catalog}>
        {!catalog && <p className="seller-loading" role="status">Cargando el catálogo…</p>}
        {catalog && preparations.length > 0 && <><h3 className="catalog-group-label">Tónicos <span>{preparations.length}</span></h3><ul className="seller-catalog-list">{preparations.map(prep => {
          const flagged = (prep.avoid ?? []).filter(id => profile.includes(id));
          return <li key={prep.id}><button aria-current={selectedId === prep.id ? "true" : undefined} className={`seller-catalog-row${flagged.length ? " flagged" : ""}`} onClick={() => onOpen(prep)}><Thumbnail image={prep.image} name={prep.name} tonic /><span className="seller-row-copy"><strong>{prep.name}</strong><span className="seller-row-description">{prep.ingredients.map(i => plantName(i.plantId)).join(" · ")}</span><span className="seller-row-tags"><span>{prep.ingredients.length} hierbas</span>{prep.uses.slice(0, 2).map(use => <span key={use}>{use}</span>)}</span>{flagged.length > 0 && <span className="seller-row-warning"><WarningCircle size={16} weight="fill" aria-hidden="true" />Evitar en {flagged.map(avoidLabel).join(" y ").toLowerCase()}</span>}{isDraft(prep.id) && <span className="seller-row-warning">Borrador · vista previa</span>}</span><ArrowUpRight className="seller-row-arrow" size={18} aria-hidden="true" /></button></li>;
        })}</ul></>}
        {catalog && plants.length > 0 && <><h3 className="catalog-group-label">Hierbas <span>{plants.length}</span></h3><ul className="seller-catalog-list">{plants.map(plant => <li key={plant.id}><button aria-current={selectedId === plant.id ? "true" : undefined} className="seller-catalog-row" onClick={() => onOpenHerb(plant)}><Thumbnail image={plant.image} name={plant.name} /><span className="seller-row-copy"><strong>{plant.name}</strong><span className="seller-row-description">{plant.scientificName || "Hierba individual"}</span><span className="seller-row-tags">{plant.uses.slice(0, 3).map(use => <span key={use}>{use}</span>)}</span></span><ArrowUpRight className="seller-row-arrow" size={18} aria-hidden="true" /></button></li>)}</ul></>}
        {catalog && !preparations.length && !plants.length && <div className="seller-empty"><h3>No encontramos fichas{query ? ` para “${query}”` : ""}.</h3><p>Probá otra palabra o cambiá el tipo de resultado.</p><button onClick={() => { setKind("all"); updateQuery(""); }}>Ver todo el catálogo</button></div>}
      </div>
    </section>
    <p className="seller-footer">Ñekurel <span>·</span> Biblioteca botánica</p>
  </section>;
}

