"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { normalize } from "@/lib/catalog";

export type ProductOption = { id: string; name: string; detail: string };

type Props = {
  label: string;
  /** Id of the chosen product, or "" while none is chosen. */
  value: string;
  onChange: (id: string) => void;
  options: ProductOption[];
  /** Ids already used in other rows. */
  taken: Set<string>;
};

/* Combobox: type to filter the products and pick one. Unlike HerbCombobox it never creates anything. */
export function ProductCombobox({ label, value, onChange, options, taken }: Props) {
  const id = useId();
  const [text, setText] = useState(() => options.find(o => o.id === value)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = normalize(text);
  const selected = options.find(o => o.id === value);
  // With a product chosen, the field shows its name: list everything so it can be changed.
  const matches = options.filter(o => !taken.has(o.id) && (!q || selected?.name === text || normalize(o.name).includes(q))).slice(0, 50);
  const expanded = open && matches.length > 0;
  const choose = (index: number) => { const option = matches[index]; if (option) { onChange(option.id); setText(option.name); } setOpen(false); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(a => (a + 1) % Math.max(matches.length, 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(a => (a - 1 + matches.length) % Math.max(matches.length, 1)); }
    else if (event.key === "Enter" && expanded) { event.preventDefault(); choose(active); }
    else if (event.key === "Escape" && expanded) { event.stopPropagation(); setOpen(false); }
  };
  return <div className="combo">
    <input role="combobox" aria-label={label} aria-expanded={expanded} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={expanded ? `${id}-${active}` : undefined} value={text} placeholder="Buscar un producto" maxLength={200} autoComplete="off"
      onChange={e => { setText(e.target.value); if (value) onChange(""); setOpen(true); setActive(0); }}
      onFocus={() => setOpen(true)}
      onBlur={() => { setOpen(false); if (!value) setText(""); }}
      onKeyDown={onKeyDown} />
    {expanded && <ul id={`${id}-list`} role="listbox" className="combo-list">
      {matches.map((o, i) => <li key={o.id} id={`${id}-${i}`} role="option" aria-selected={i === active} className="combo-option" onMouseDown={e => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}>
        <span>{o.name}</span><small>{o.detail}</small>
      </li>)}
    </ul>}
  </div>;
}
