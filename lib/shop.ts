import { assignSlugs, formatPrice, getCategories, itemCategories, searchCatalog, type Catalog, type Plant, type Preparation } from "./catalog.ts";
import { readCatalog } from "./store.ts";

export type ShopItem = {
  id: string; slug: string; name: string; tonic: boolean; price: string; image?: string;
  categoryId: string; categoryLabel: string;
  /** One line for the grid: ingredients for tonics, first uses for herbs. */
  summary: string;
  item: Plant | Preparation;
};

/** Everything the public catalogue shows: published items only, each under its first matching category. */
export async function loadShop(): Promise<{ catalog: Catalog; items: ShopItem[] }> {
  const catalog = await readCatalog();
  const visible = searchCatalog(catalog, "");
  const all: (Plant | Preparation)[] = [...visible.preparations, ...visible.plants.filter(p => p.published)];
  const slugs = assignSlugs(all.map(item => ({ id: item.id, name: item.name, tonic: "ingredients" in item })));
  const categories = getCategories(catalog);
  const herb = (id: string) => catalog.plants.find(p => p.id === id)?.name ?? "";
  const items: ShopItem[] = [];
  for (const item of all) {
    const category = categories.find(c => itemCategories(item).includes(c.id));
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
