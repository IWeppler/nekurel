"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalize } from "@/lib/catalog";

export type HerbOption = { id: string; name: string; tonics: number };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: HerbOption[];
  /** Normalized names already used in other rows of the same tonic. */
  taken: Set<string>;
};

/* Combobox: type to filter known herbs, pick one, or keep the text to create a new herb. */
export function HerbCombobox({ label, value, onChange, options, taken }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = normalize(value);
  const matches = options.filter(o => !taken.has(normalize(o.name)) && (!q || normalize(o.name).includes(q))).slice(0, 8);
  const exact = options.some(o => normalize(o.name) === q);
  const canCreate = q.length > 0 && !exact;
  const count = matches.length + (canCreate ? 1 : 0);
  const expanded = open && count > 0;
  const choose = (index: number) => { if (index < matches.length) onChange(matches[index].name); setOpen(false); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(a => (a + 1) % Math.max(count, 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(a => (a - 1 + count) % Math.max(count, 1)); }
    else if (event.key === "Enter" && expanded) { event.preventDefault(); choose(active); }
    else if (event.key === "Escape" && expanded) { event.stopPropagation(); setOpen(false); }
  };
  return <div className="combo">
    <input role="combobox" aria-label={label} aria-expanded={expanded} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={expanded ? `${id}-${active}` : undefined} value={value} placeholder="Ej.: Manzanilla" maxLength={200} autoComplete="off" required
      onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} />
    {expanded && <ul id={`${id}-list`} role="listbox" className="combo-list">
      {matches.map((o, i) => <li key={o.id} id={`${id}-${i}`} role="option" aria-selected={i === active} className="combo-option" onMouseDown={e => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}>
        <span>{o.name}</span><small>{o.tonics === 1 ? "En 1 tónico" : `En ${o.tonics} tónicos`}</small>
      </li>)}
      {canCreate && <li id={`${id}-${matches.length}`} role="option" aria-selected={active === matches.length} className="combo-option is-new" onMouseDown={e => { e.preventDefault(); choose(matches.length); }} onMouseEnter={() => setActive(matches.length)}>
        <span>Agregar {value.trim()} como hierba nueva</span>
      </li>}
    </ul>}
  </div>;
}
