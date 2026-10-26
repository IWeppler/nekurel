import { assignSlugs, formatPrice, storeCategory, type Catalog, type Plant, type Preparation } from "./catalog.ts";
import { readCatalog } from "./store.ts";

export type ShopItem = {
  id: string; slug: string; name: string; tonic: boolean; price: string; image?: string;
  categoryId: string; categoryLabel: string;
  /** One line for the grid: ingredients for tonics, first uses for herbs. */
  summary: string;
  item: Plant | Preparation;
};

/** Everything the public catalogue shows: products in the store (see storeCategory), each under its first visible category. */
export async function loadShop(): Promise<{ catalog: Catalog; items: ShopItem[] }> {
  const catalog = await readCatalog();
  const published: (Plant | Preparation)[] = [...catalog.preparations, ...catalog.plants].filter(item => item.published);
  // Slugs come from every published product, not only the visible ones, so hiding one product never changes another's link.
  const slugs = assignSlugs(published.map(item => ({ id: item.id, name: item.name, tonic: "ingredients" in item })));
  const herb = (id: string) => catalog.plants.find(p => p.id === id)?.name ?? "";
  const items: ShopItem[] = [];
  for (const item of published) {
    const category = storeCategory(catalog, item);
    if (!category) continue;
    const tonic = "ingredients" in item;
    items.push({
      id: item.id, slug: slugs.get(item.id)!, name: item.name, tonic, image: item.image, price: formatPrice(item),
      categoryId: category.id, categoryLabel: category.label, item,
      summary: tonic ? item.ingredients.map(i => herb(i.plantId)).filter(Boolean).join(", ") : item.uses.slice(0, 3).join(", "),
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { catalog, items };
}
