"use client";

import { useId, useState } from "react";
import { X } from "@phosphor-icons/react";
import { normalize } from "@/lib/catalog";

export function AvoidSelector({ value, options, onChange }: { value: string[]; options: { id: string; label: string }[]; onChange: (value: string[]) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const add = () => {
    const text = query.trim();
    if (!text) return;
    const option = options.find(o => normalize(o.label) === normalize(text) || normalize(o.id) === normalize(text));
    const selected = option?.id ?? text;
    if (!value.some(v => normalize(v) === normalize(selected))) onChange([...value, selected]);
    setQuery("");
  };
  return <fieldset className="ingredients-editor">
    <legend>No recomendado en</legend>
    <p>Elegí una situación o escribí una nueva y agregala.</p>
    <div className="avoid-selector-row">
      <input aria-label="No recomendado en" aria-autocomplete="list" list={id} value={query} maxLength={200} placeholder="Buscar o agregar situación" onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <datalist id={id}>{options.filter(o => !value.includes(o.id)).map(o => <option key={o.id} value={o.label} />)}</datalist>
      <button className="button" type="button" disabled={!query.trim() || value.length >= 100} onClick={add}>Agregar</button>
    </div>
    <div className="avoid-selected">{value.map(v => <span key={v}>{options.find(o => o.id === v)?.label ?? v}<button type="button" aria-label={`Quitar ${options.find(o => o.id === v)?.label ?? v}`} onClick={() => onChange(value.filter(item => item !== v))}><X size={18} aria-hidden="true" /></button></span>)}</div>
  </fieldset>;
}

