"use client";

import { getCategories, itemCategories, type Catalog, type Plant, type Preparation } from "@/lib/catalog";

export function CategoryPicker({ catalog, item }: { catalog: Catalog; item: Plant | Preparation }) {
  const selected = itemCategories(item);
  return <fieldset className="ingredients-editor"><legend>Categorías</legend><p>Elegí una o varias categorías para esta ficha.</p><div className="category-picker">{getCategories(catalog).map(category => <label className="check" key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={selected.includes(category.id)} />{category.label}</label>)}</div></fieldset>;
}
