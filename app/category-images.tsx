"use client";

import { useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { ImageField } from "./catalog-image";
import { AutoSaveForm } from "./auto-save-form";
import { Screen } from "./screen";
import { categoryOptions, type Category, type CategoryImages } from "@/lib/catalog";

export function CategoryImageEditor({ initial, initialCategories, onSave, onClose, error }: { initial: CategoryImages; initialCategories: Category[]; onSave: (categories: Category[], images: CategoryImages) => Promise<boolean>; onClose: () => void; error: string }) {
  const [images, setImages] = useState(initial);
  const [categories, setCategories] = useState(initialCategories);
  const [uploading, setUploading] = useState(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  return <div className="category-editor"><Screen title="Categorías" onClose={async () => { if (!uploading && await flushRef.current()) onClose(); }}>
    <p className="section-note">Editá los nombres y las imágenes, o agregá una categoría. Los cambios se guardan automáticamente.</p>
    <AutoSaveForm registerRef={flushRef} paused={uploading} changes={JSON.stringify([categories, images])} onSave={form => form.checkValidity() ? onSave(categories.map(c => ({ ...c, label: c.label.trim() })), images) : Promise.resolve(false)}>
      <fieldset className="autosave-fields" disabled={uploading}><div className="category-edit-grid">{categories.map(category => {
        const original = categoryOptions.find(c => c.id === category.id);
        return <section className="category-edit-card" key={category.id} data-category={category.id} aria-label={`Categoría ${category.label}`}>
          <label className="field"><span>Nombre de la categoría</span><input aria-label={`Nombre de categoría ${category.label}`} value={category.label} required maxLength={100} onChange={e => setCategories(current => current.map(c => c.id === category.id ? { ...c, label: e.target.value } : c))} /></label>
          {!images[category.id] && <div className="category-edit-preview"><span className={`category-photo${original ? " category-fallback" : " category-empty"}`} style={{ backgroundPosition: `${original?.position ?? "50%"} center` }} role="img" aria-label={`Imagen de ${category.label}`} />{!original && <span className="category-empty-label">Agregá una imagen</span>}</div>}
          <ImageField label="Imagen de categoría" value={images[category.id]} onChange={image => setImages(current => ({ ...current, [category.id]: image }))} onBusy={setUploading} />
        </section>;
      })}</div>
      <button type="button" className="button primary" disabled={categories.length >= 50} onClick={() => { let n = 1; while (categories.some(c => c.label === `Nueva categoría ${n}`)) n++; setCategories(current => [...current, { id: crypto.randomUUID(), label: `Nueva categoría ${n}` }]); }}><Plus size={22} aria-hidden="true" />Agregar categoría</button></fieldset>
      {error && <div className="alert error" role="alert">{error}</div>}
    </AutoSaveForm>
  </Screen></div>;
}
