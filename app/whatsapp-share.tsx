"use client";
import { useState } from "react";
import { WhatsappIcon } from "./whatsapp-icon";
import { whatsappUrl } from "@/lib/recipe";

export function WhatsAppShare({ message, error = "" }: { message: string; error?: string }) {
  const [number, setNumber] = useState("");
  let url = "", invalid = "";
  if (number.trim()) { try { url = whatsappUrl(number, message); } catch (e) { invalid = (e as Error).message; } }
  return <section className="whatsapp-share no-print"><h3><WhatsappIcon size={24} />Compartir por WhatsApp</h3><label className="field"><span>Número del cliente</span><input type="tel" inputMode="tel" autoComplete="off" value={number} onChange={e => setNumber(e.target.value)} placeholder="3491 1234 5678" maxLength={32} /></label>
    {error && <p className="share-error" role="alert">{error}</p>}{invalid && <p className="share-error" role="alert">{invalid}</p>}
    <details><summary>Revisar el mensaje</summary><pre className="message-preview">{message || error}</pre></details>
    {url && !error && message ? <a className="button primary" href={url} target="_blank" rel="noopener noreferrer"><WhatsappIcon size={22} />Abrir WhatsApp</a> : <button className="button primary" type="button" disabled><WhatsappIcon size={22} />Abrir WhatsApp</button>}
  </section>;
}
