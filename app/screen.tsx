"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

/* Full-screen panel. Not a modal: it replaces the page and is closed with the X. */
export function Screen({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; previous?.focus?.(); };
  }, []);
  return <section ref={ref} tabIndex={-1} className="screen" aria-labelledby="screen-title">
    <header className="screen-bar">
      <button className="close-button" onClick={onClose} aria-label="Cerrar"><X size={32} weight="bold" aria-hidden="true" /></button>
    </header>
    <div className="screen-body">
      <h2 id="screen-title">{title}</h2>
      {children}
    </div>
  </section>;
}
