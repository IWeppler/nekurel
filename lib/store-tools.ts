import { getCategories, itemCategories, type Catalog, type Plant, type Preparation } from "./catalog.ts";

/** Pure helpers for the Tienda tab of the administrator (docs/tienda-online.md, fases 2 y 3). */

export type SocialKind = "instagram" | "facebook";
const socialHost = { instagram: "instagram.com", facebook: "facebook.com" } as const;

/**
 * The link for a social profile typed as "@nekurel", "nekurel", "instagram.com/nekurel" or a full https link.
 * Undefined when the text cannot be turned into a safe link (the store then shows it as plain text).
 */
export function socialLink(value: string | undefined, kind: SocialKind): { href: string; label: string } | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (/^https:\/\/[^\s]+$/.test(text)) return { href: text, label: text.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "") };
  const path = text.replace(/^(https?:\/\/)?(www\.)?(instagram|facebook)\.com\//i, "");
  const handle = path.replace(/^@/, "").replace(/\/$/, "");
  // Only characters that can appear in a profile path: anything else (spaces, colons, quotes) is not turned into a link.
  if (!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(handle) || /^[a-z]+:/i.test(handle)) return undefined;
  return { href: `https://${socialHost[kind]}/${handle}`, label: kind === "instagram" ? `@${handle}` : handle };
}

/** Digits only, ready for wa.me. Drops spaces, "+", dashes and parentheses. */
export const whatsappDigits = (value: string) => value.replace(/\D/g, "");

/* ---- Bulk price editing ---- */

export type PriceEdit = { price?: string; unit?: string };
export type PriceEdits = Record<string, PriceEdit>;
export type PriceRow = { id: string; name: string; tonic: boolean; categoryIds: string[]; categoryLabel: string; price?: number; unit: string; hidden: boolean };

const cents = (value: number) => Math.round(value * 100) / 100;
/** Parses what the owner typed in a price cell. Empty means "no price" and is valid. */
export function parsePriceText(text: string): { value?: number; error?: string } {
  const clean = text.trim().replace(",", ".");
  if (!clean) return {};
  const value = Number(clean);
  if (!Number.isFinite(value) || value < 0) return { error: "Escribí un precio de 0 o más." };
  if (value > 100_000_000) return { error: "El precio es demasiado alto." };
  return { value: cents(value) };
}
/** Price text as shown in an input: no trailing zeros and no thousands separator. */
export const priceText = (value: number | undefined) => value === undefined ? "" : String(value);

export type BulkAction =
  | { kind: "percent"; percent: number }
  | { kind: "round"; step: number }
  | { kind: "fixed"; price: number };

/** Result of a bulk action on one price. Undefined means "leave it as it is" (the product has no price to adjust). */
export function bulkPrice(current: number | undefined, action: BulkAction): number | undefined {
  if (action.kind === "fixed") return cents(action.price);
  if (current === undefined) return undefined;
  if (action.kind === "percent") return cents(current * (1 + action.percent / 100));
  return cents(Math.round(current / action.step) * action.step);
}
/** Spanish message when the action's number is unusable, or undefined when it can run. */
export function bulkError(action: BulkAction): string | undefined {
  if (action.kind === "percent") {
    if (!Number.isFinite(action.percent) || action.percent === 0) return "Escribí un porcentaje distinto de 0.";
    if (action.percent <= -100) return "Bajar 100% o más dejaría los precios en 0 o negativos.";
    if (action.percent > 1000) return "El porcentaje es demasiado alto.";
  } else if (action.kind === "round") {
    if (!Number.isFinite(action.step) || action.step <= 0) return "Escribí un múltiplo mayor que 0, por ejemplo 50 o 100.";
  } else if (!Number.isFinite(action.price) || action.price < 0) return "Escribí un precio de 0 o más.";
  return undefined;
}

/** What each pending edit would leave in the cell, with its validation error if any. */
export function resolveEdit(row: PriceRow, edit: PriceEdit | undefined): { price?: number; unit: string; error?: string; changed: boolean } {
  const parsed = edit?.price === undefined ? { value: row.price } : parsePriceText(edit.price);
  const unit = edit?.unit === undefined ? row.unit : edit.unit.trim();
  const changed = !parsed.error && (parsed.value !== row.price || unit !== row.unit);
  return { price: parsed.value, unit, error: parsed.error, changed };
}
export type EditSummary = { changed: number; errors: number; lowersPromo: number };
export function summarizeEdits(rows: PriceRow[], edits: PriceEdits, catalog: Catalog): EditSummary {
  let changed = 0, errors = 0, lowersPromo = 0;
  for (const row of rows) {
    const result = resolveEdit(row, edits[row.id]);
    if (result.error) errors++;
    if (!result.changed) continue;
    changed++;
    const promo = [...catalog.plants, ...catalog.preparations].find(p => p.id === row.id)?.promoPrice;
    if (promo !== undefined && result.price !== undefined && promo >= result.price) lowersPromo++;
  }
  return { changed, errors, lowersPromo };
}

/** The catalogue with every valid pending edit applied. Products without changes are returned untouched. */
export function applyPriceEdits(catalog: Catalog, edits: PriceEdits): Catalog {
  const rows = new Map(priceRows(catalog).map(row => [row.id, row]));
  const apply = <T extends Plant | Preparation>(item: T): T => {
    const row = rows.get(item.id);
    const result = row && resolveEdit(row, edits[item.id]);
    if (!result || !result.changed) return item;
    return { ...item, price: result.price, priceUnit: result.unit || undefined };
  };
  return { ...catalog, plants: catalog.plants.map(apply), preparations: catalog.preparations.map(apply) };
}

/** One row per tonic and herb, with every category it belongs to. */
export function priceRows(catalog: Catalog): PriceRow[] {
  const categories = getCategories(catalog);
  const row = (item: Plant | Preparation, tonic: boolean): PriceRow => {
    const categoryIds = itemCategories(item);
    return { id: item.id, name: item.name, tonic, categoryIds, categoryLabel: categoryIds.map(id => categories.find(c => c.id === id)?.label).filter(Boolean).join(", "), price: item.price, unit: item.priceUnit?.trim() ?? "", hidden: Boolean(item.hidden) };
  };
  return [...catalog.preparations.map(item => row(item, true)), ...catalog.plants.map(item => row(item, false))].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
