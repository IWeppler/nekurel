import { assignSlugs, comboSavings, comboSlug, effectivePrice, findProduct, formatMoney, isComboInStore, storeCategory, storeToday, type Catalog, type EffectivePrice, type Plant, type Preparation, type StoreSettings } from "./catalog.ts";
import type { Offer } from "./cart.ts";

export type ShopItem = {
  /** Cart key: "p:<id>". */
  key: string;
  id: string; slug: string; name: string; tonic: boolean; image?: string;
  /** Price to show: the sale price while a promotion runs. "" when the product has no price ("Consultar"). Includes the unit. */
  price: string;
  /** Regular price, only while on promotion (to show crossed out). */
  regularPrice?: string;
  pricing: EffectivePrice;
  categoryId: string; categoryLabel: string;
  /** One line for the grid: ingredients for tonics, first uses for herbs. */
  summary: string;
  /** Full record, for server-rendered pages only. Never pass it to a client component: it holds internal notes. */
  item: Plant | Preparation;
};
export type ShopCombo = {
  /** Cart key: "c:<id>". */
  key: string;
  id: string; slug: string; name: string; description: string; image?: string;
  price: string; priceValue: number;
  /** "Ahorrás $ 1.000" data, only when every product has a price and the combo is cheaper. */
  regularPrice?: string; savings?: string;
  items: { name: string; qty: number; slug?: string }[];
};
export type Shop = {
  catalog: Catalog; items: ShopItem[]; combos: ShopCombo[];
  /** Everything that can go in the cart, with current prices. Safe to send to the browser. */
  offers: Offer[];
  store: StoreSettings;
};

const withUnit = (amount: string, unit: string) => unit ? `${amount} / ${unit}` : amount;

/**
 * Everything the public store shows: products in the store (see storeCategory), each under its first
 * visible category, and the combos whose products are all in the store. Prices are resolved for `today`.
 */
export async function loadShop(today = storeToday()): Promise<Shop> {
  // Imported here so buildShop stays importable from the Node test runner, which cannot load the Supabase store.
  const { readCatalog } = await import("./store.ts");
  return buildShop(await readCatalog(), today);
}
export function buildShop(catalog: Catalog, today: string): Shop {
  const published: (Plant | Preparation)[] = [...catalog.preparations, ...catalog.plants].filter(item => item.published);
  // Slugs come from every published product, not only the visible ones, so hiding one product never changes another's link.
  const slugs = assignSlugs(published.map(item => ({ id: item.id, name: item.name, tonic: "ingredients" in item })));
  const herb = (id: string) => catalog.plants.find(p => p.id === id)?.name ?? "";
  const items: ShopItem[] = [];
  for (const item of published) {
    const category = storeCategory(catalog, item);
    if (!category) continue;
    const tonic = "ingredients" in item;
    const pricing = effectivePrice(item, today);
    items.push({
      key: `p:${item.id}`, id: item.id, slug: slugs.get(item.id)!, name: item.name, tonic, image: item.image, pricing,
      price: pricing.price === undefined ? "" : withUnit(formatMoney(pricing.price), pricing.unit),
      ...(pricing.onPromo ? { regularPrice: withUnit(formatMoney(pricing.regular!), pricing.unit) } : {}),
      categoryId: category.id, categoryLabel: category.label, item,
      summary: tonic ? item.ingredients.map(i => herb(i.plantId)).filter(Boolean).join(", ") : item.uses.slice(0, 3).join(", "),
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const combos: ShopCombo[] = (catalog.combos ?? []).filter(combo => isComboInStore(catalog, combo)).map(combo => {
    const saving = comboSavings(catalog, combo);
    return {
      key: `c:${combo.id}`, id: combo.id, slug: comboSlug(combo), name: combo.name, description: combo.description, image: combo.image,
      price: formatMoney(combo.price), priceValue: combo.price,
      ...(saving && saving.savings > 0 ? { regularPrice: formatMoney(saving.regular), savings: formatMoney(saving.savings) } : {}),
      items: combo.items.map(({ productId, qty }) => ({ name: findProduct(catalog, productId)!.name, qty, slug: slugs.get(productId) })),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const offers: Offer[] = [
    ...items.map(({ key, name, pricing }) => ({ key, name, unit: pricing.unit, price: pricing.price })),
    ...combos.map(({ key, name, priceValue }) => ({ key, name, unit: "", price: priceValue })),
  ];
  return { catalog, items, combos, offers, store: catalog.store ?? {} };
}
