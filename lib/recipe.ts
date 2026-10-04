import { avoidOptions, type Catalog, type Plant, type Preparation } from "./catalog.ts";

export const partsOf = (amount: string) => {
  const match = amount.trim().match(/^(\d+(?:[.,]\d+)?)\s*partes?\s*$/i);
  const value = match ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
};
export const grams = (value: number) => `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} g`;

export function recipeText(prep: Preparation, catalog: Catalog, options: { selected: string[]; total?: number; instructions?: string }) {
  const ingredients = prep.ingredients.filter(i => options.selected.includes(i.plantId));
  if (!ingredients.length) throw new Error("Elegí al menos una hierba para compartir.");
  const partial = ingredients.length !== prep.ingredients.length;
  const instructions = partial ? options.instructions?.trim() : prep.instructions;
  if (partial && !instructions) throw new Error("Completá la preparación para las hierbas seleccionadas.");
  const parts = ingredients.map(i => partsOf(i.amount));
  const sum = parts.reduce<number>((value, part) => value + (part ?? 0), 0);
  const total = options.total;
  if (total !== undefined && (!Number.isFinite(total) || total <= 0 || total > 100000 || parts.some(p => p === null))) throw new Error("Revisá la cantidad total de la mezcla.");
  const herb = (id: string) => catalog.plants.find(p => p.id === id);
  const warnings = [prep.warnings, ...ingredients.map(i => { const p = herb(i.plantId); return p?.warnings ? `${p.name}: ${p.warnings}` : ""; })].filter(Boolean);
  return [partial ? `Selección de hierbas de ${prep.name}` : prep.name,
    !partial && prep.uses.length ? `Usos tradicionales: ${prep.uses.join(", ")}` : "", "", "Hierbas:",
    ...ingredients.map((i, n) => `- ${herb(i.plantId)?.name ?? "Hierba no disponible"}: ${i.amount || "Proporción no indicada"}${total === undefined ? "" : ` (${grams(total * parts[n]! / sum)})`}`),
    total === undefined ? "" : `Total de la mezcla: ${grams(total)}`, "", instructions ? `Preparación: ${instructions}` : "",
    warnings.length ? `Advertencias:\n${warnings.join("\n")}` : "Advertencias: consultar con la herboristería antes de utilizar.",
    prep.avoid?.length ? `No recomendado en: ${prep.avoid.map(id => avoidOptions.find(o => o.id === id)?.label ?? id).join(", ")}` : "", "", "Ñekurel",
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function herbText(plant: Plant) {
  return [plant.name, plant.scientificName, plant.properties, plant.uses.length ? `Usos tradicionales: ${plant.uses.join(", ")}` : "", `Advertencias: ${plant.warnings || "Consultar con la herboristería antes de utilizar."}`, "", "Ñekurel"].filter(Boolean).join("\n");
}
export function whatsappUrl(number: string, text: string) {
  const raw = number.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) throw new Error("Ingresá un número válido con código de país.");
  const digits = raw.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("Ingresá el número completo con código de país, sin el 0 inicial.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
