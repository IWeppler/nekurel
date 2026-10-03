"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight, Calculator, Check, Copy, Leaf, MagnifyingGlass, Printer, TrendUp, WarningCircle, X } from "@phosphor-icons/react";
import { Screen } from "./screen";
import { avoidOptions, type Catalog, type Preparation } from "@/lib/catalog";

const avoidLabel = (id: string) => avoidOptions.find(o => o.id === id)?.label ?? id;
/** "2 partes" -> 2. Returns null when the amount is not expressed in parts. */
const partsOf = (amount: string) => {
  const match = amount.trim().match(/^(\d+(?:[.,]\d+)?)\s*partes?\b/i);
  return match ? parseFloat(match[1].replace(",", ".")) : null;
};
const grams = (value: number) => `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} g`;

type Props = {
  catalog: Catalog | null;
  query: string;
  onQuery: (value: string) => void;
  results: Preparation[];
  suggestions: string[];
  plantName: (id: string) => string;
  isDraft: (id: string) => boolean;
  onOpen: (prep: Preparation) => void;
  profile: string[];
  onProfile: (value: string[]) => void;
  topIds: Set<string>;
};

export function Finder({ catalog, query, onQuery, results, suggestions, plantName, isDraft, onOpen, profile, onProfile, topIds }: Props) {
  const searching = query.trim().length > 0;
  const toggle = (id: string) => onProfile(profile.includes(id) ? profile.filter(p => p !== id) : [...profile, id]);
  return <section className="finder">
    <div className="hero">
      <h1 id="finder-title">¿Qué necesita el cliente?</h1>
      <div className="search-box">
        <MagnifyingGlass size={26} weight="bold" aria-hidden="true" />
        <input type="search" inputMode="search" enterKeyHint="search" aria-labelledby="finder-title" value={query} onChange={e => onQuery(e.target.value)} placeholder="Dolor de panza, insomnio, manzanilla" autoComplete="off" autoCorrect="off" spellCheck={false} />
        {query && <button className="icon-button" aria-label="Borrar búsqueda" onClick={() => onQuery("")}><X size={22} weight="bold" aria-hidden="true" /></button>}
      </div>
      {suggestions.length > 0 && <div className="chips" role="group" aria-label="Búsquedas frecuentes">
        {suggestions.map(s => <button key={s} className="chip" aria-pressed={query === s} onClick={() => onQuery(query === s ? "" : s)}>{s}</button>)}
      </div>}
      <div className="profile" role="group" aria-label="Situación del cliente">
        <span>Cliente con</span>
        {avoidOptions.map(o => <button key={o.id} className="chip small" aria-pressed={profile.includes(o.id)} onClick={() => toggle(o.id)}>{o.label}</button>)}
      </div>
    </div>
    <div className="results" aria-live="polite" aria-busy={!catalog}>
      {!catalog && <div className="skeleton-list" aria-hidden="true"><span /><span /><span /><span /></div>}
      {catalog && <h2 className="results-title">{searching ? `${results.length} ${results.length === 1 ? "tónico encontrado" : "tónicos encontrados"}` : "Todos los tónicos"}</h2>}
      {results.length > 0 && <ul className="tonic-list">{results.map((prep, index) => {
        const flagged = (prep.avoid ?? []).filter(id => profile.includes(id));
        return <li key={prep.id} style={{ "--i": Math.min(index, 8) } as CSSProperties}>
          <button className={`tonic-card${flagged.length ? " is-flagged" : ""}`} onClick={() => onOpen(prep)}>
            <span className="tonic-head">
              <strong>{prep.name}</strong>
              <span className="go" aria-hidden="true"><ArrowUpRight size={22} weight="bold" /></span>
            </span>
            {flagged.length > 0 && <span className="avoid-badge"><WarningCircle size={18} weight="fill" aria-hidden="true" />Evitar en {flagged.map(avoidLabel).join(" y ").toLowerCase()}</span>}
            {prep.uses.length > 0 && <span className="tonic-uses">{prep.uses.slice(0, 3).join(", ")}</span>}
            <span className="tonic-herbs">{prep.ingredients.map(i => <span key={i.plantId}><Leaf size={16} weight="fill" aria-hidden="true" />{plantName(i.plantId)}</span>)}</span>
            {!searching && topIds.has(prep.id) && <span className="top-badge"><TrendUp size={16} weight="bold" aria-hidden="true" />Más consultado</span>}
            {isDraft(prep.id) && <em>Borrador, solo vista previa</em>}
          </button>
        </li>;
      })}</ul>}
      {catalog && !results.length && <div className="empty">
        <h3>{searching ? "No hay un tónico para esa búsqueda" : "Todavía no hay tónicos cargados"}</h3>
        <p>{searching ? "Probá con otra palabra, por ejemplo el síntoma que cuenta el cliente. Ante la duda, consultá con el dueño." : "Cuando el dueño habilite los tónicos van a aparecer acá."}</p>
      </div>}
    </div>
  </section>;
}

export function TonicDetail({ prep, catalog, plantName, preview, profile, onClose, onEdit }: { prep: Preparation; catalog: Catalog | null; plantName: (id: string) => string; preview: boolean; profile: string[]; onClose: () => void; onEdit?: () => void }) {
  const [calculating, setCalculating] = useState(false);
  const [total, setTotal] = useState(100);
  const [copied, setCopied] = useState(false);
  const plantWarnings = prep.ingredients.flatMap(i => { const plant = catalog?.plants.find(p => p.id === i.plantId); return plant?.warnings ? [{ name: plant.name, text: plant.warnings }] : []; });
  const parts = prep.ingredients.map(i => partsOf(i.amount));
  const canCalculate = parts.every(p => p !== null);
  const sum = parts.reduce<number>((acc, p) => acc + (p ?? 0), 0);
  const amountFor = (index: number) => calculating && canCalculate && sum > 0 ? grams((total * (parts[index] ?? 0)) / sum) : null;
  const avoid = prep.avoid ?? [];

  const summary = () => {
    const warnings = [prep.warnings, ...plantWarnings.map(w => `${w.name}: ${w.text}`)].filter(Boolean).join(" ");
    return [
      prep.name,
      prep.uses.length ? `Para: ${prep.uses.join(", ")}` : "",
      "",
      "Hierbas:",
      ...prep.ingredients.map((i, n) => `- ${plantName(i.plantId)}: ${i.amount || "pendiente"}${amountFor(n) ? ` (${amountFor(n)})` : ""}`),
      calculating && canCalculate ? `Total de la mezcla: ${grams(total)}` : "",
      "",
      prep.instructions ? `Preparación: ${prep.instructions}` : "",
      warnings ? `Advertencias: ${warnings}` : "",
      avoid.length ? `No recomendado en: ${avoid.map(avoidLabel).join(", ")}` : "",
      "",
      "Ñekurel",
    ].join("\n").replace(/\n{3,}/g, "\n\n");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary()); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return <Screen title={prep.name} onClose={onClose}>
    {preview && <p className="preview-note no-print">Vista previa del administrador. Revisá esta ficha antes de habilitarla.</p>}
    <section className="warning-panel" aria-labelledby="warn-title">
      <h3 id="warn-title"><WarningCircle size={30} weight="fill" aria-hidden="true" />Advertencias</h3>
      {avoid.length > 0 && <div className="avoid-list"><span>No recomendado en</span>{avoid.map(id => <strong key={id} className={profile.includes(id) ? "is-match" : undefined}>{avoidLabel(id)}</strong>)}</div>}
      {prep.warnings ? <p>{prep.warnings}</p> : <p>No hay advertencias cargadas. Confirmá con el dueño antes de orientar al cliente.</p>}
      {plantWarnings.map(w => <p key={w.name}><strong>{w.name}: </strong>{w.text}</p>)}
    </section>
    <section>
      <h3>Para qué se usa</h3>
      {prep.uses.length ? <ul className="use-list">{prep.uses.map(use => <li key={use}>{use}</li>)}</ul> : <p>Sin completar.</p>}
    </section>
    <section>
      <h3>Ingredientes</h3>
      <ul className="ingredient-list">{prep.ingredients.map((i, n) => <li key={i.plantId}><span>{plantName(i.plantId)}</span><span className="amounts">{amountFor(n) && <b>{amountFor(n)}</b>}<strong>{i.amount || "Pendiente"}</strong></span></li>)}</ul>
      {canCalculate && <div className="calc no-print">
        {!calculating ? <button className="button" onClick={() => setCalculating(true)}><Calculator size={20} weight="bold" aria-hidden="true" />Calcular cantidades</button> : <>
          <label htmlFor="calc-total">Cantidad total de la mezcla (gramos)</label>
          <div className="calc-row">
            <input id="calc-total" type="number" inputMode="decimal" min={1} max={100000} value={total || ""} onChange={e => setTotal(Math.max(0, Number(e.target.value)))} />
            {[50, 100, 250, 500].map(v => <button key={v} className="chip small" aria-pressed={total === v} onClick={() => setTotal(v)}>{v} g</button>)}
            <button className="button" onClick={() => setCalculating(false)}>Ocultar</button>
          </div>
        </>}
      </div>}
    </section>
    <section>
      <h3>Preparación</h3>
      <p className="prose">{prep.instructions || "El dueño todavía debe completar las indicaciones."}</p>
    </section>
    {prep.notes && <section className="no-print"><h3>Notas internas</h3><p className="prose">{prep.notes}</p></section>}
    <div className="detail-actions no-print">
      <button className="button primary" onClick={() => void copy()}>{copied ? <Check size={20} weight="bold" aria-hidden="true" /> : <Copy size={20} weight="bold" aria-hidden="true" />}{copied ? "Copiado" : "Copiar"}</button>
      <button className="button" onClick={() => window.print()}><Printer size={20} weight="bold" aria-hidden="true" />Imprimir</button>
      {onEdit && <button className="button" onClick={onEdit}>Editar ficha</button>}
    </div>
  </Screen>;
}
