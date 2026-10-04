"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, DownloadSimple, Leaf, MagnifyingGlass, Plus, Storefront, LockKey, Trash, UploadSimple, WifiSlash, X } from "@phosphor-icons/react";
import { TonicDetail, HerbDetail } from "./finder";
import { Finder } from "./seller-finder";
import { CatalogImage, ImageField } from "./catalog-image";
import { HerbCombobox } from "./herb-combobox";
import { Screen } from "./screen";
import { avoidOptions, normalize, searchCatalog, type Catalog, type Plant, type Preparation } from "@/lib/catalog";
import { exportTonics, importTonics, type ImportReport } from "@/lib/csv";

type Tab = "search" | "tonics" | "herbs";
type Draft = { name: string; amount: string };
const labels: Record<Tab, string> = { search: "Buscador", tonics: "Tónicos", herbs: "Hierbas" };
const splitTags = (text: string) => [...new Set(text.split(/[,\n]/).map(t => t.trim()).filter(Boolean))];
const blankTonic = (): Preparation => ({ id: crypto.randomUUID(), name: "", uses: [], aliases: [], ingredients: [], instructions: "", warnings: "", notes: "", published: false, avoid: [] });
const newHerb = (name: string): Plant => ({ id: crypto.randomUUID(), name, scientificName: "", properties: "", uses: [], aliases: [], warnings: "", notes: "", published: true });

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}
function Field({ label, name, value = "", multiline = false, required = false, hint, rows = 3 }: { label: string; name: string; value?: string; multiline?: boolean; required?: boolean; hint?: string; rows?: number }) {
  return <label className="field"><span>{label}{required && <span className="required"> *</span>}</span>{multiline ? <textarea name={name} defaultValue={value} rows={rows} maxLength={10000} required={required} /> : <input name={name} defaultValue={value} maxLength={10000} required={required} />}{hint && <small>{hint}</small>}</label>;
}
export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [adminAccess, setAdmin] = useState(false);
  const [role, setRole] = useState<"seller" | "admin" | null>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const admin = role === "admin" && adminAccess;
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [login, setLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [editor, setEditor] = useState<Preparation | null>(null);
  const [herbEditor, setHerbEditor] = useState<Plant | null>(null);
  const [herbDetail, setHerbDetail] = useState<Plant | null>(null);
  const [image, setImage] = useState("");
  const [detail, setDetail] = useState<Preparation | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<Preparation | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const load = useCallback(async () => {
    try {
      const session = await api<{ admin: boolean }>("/api/session").catch(() => ({ admin: false }));
      const data = await api<Catalog>(role === "admin" ? "/api/catalog" : "/api/catalog?scope=public");
      setAdmin(session.admin); setCatalog(data); setError(""); if (!session.admin) { setTab("search"); setPreview(false); if (role === "admin") setRole(null); }
      setUsage(await api<Record<string, number>>("/api/usage").catch(() => ({})));
    } catch (e) { setError((e as Error).message); }
  }, [role]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => {
    const refresh = () => { if (!editor && !herbEditor && !deleting && !login && !busy && !report) void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [load, editor, herbEditor, deleting, login, busy, report]);
  const plantName = useCallback((id: string) => catalog?.plants.find(p => p.id === id)?.name || "Hierba no disponible", [catalog]);
  const openEditor = (tonic: Preparation) => { setEditor(tonic); setImage(tonic.image || ""); setFormError(""); setDrafts(tonic.ingredients.map(i => ({ name: plantName(i.plantId), amount: i.amount }))); };
  const openHerbEditor = (plant: Plant) => { setHerbEditor(plant); setImage(plant.image || ""); setFormError(""); };
  const openDetail = (prep: Preparation) => {
    setHerbDetail(null);
    setDetail(prep);
    if (admin) return;
    setUsage(u => ({ ...u, [prep.id]: (u[prep.id] ?? 0) + 1 }));
    void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: prep.id }) }).catch(() => undefined);
  };
  const save = async (next: Catalog) => {
    setBusy(true); setFormError("");
    try { const saved = await api<Catalog>("/api/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); setCatalog(saved); setNotice("Cambios guardados en el catálogo."); return true; }
    catch (e) { setFormError((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editor || !catalog) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (!drafts.length || drafts.some(d => !d.name.trim())) { setFormError("Agregá al menos una hierba y completá todos los nombres."); return; }
    const plants = [...catalog.plants];
    const ingredients = drafts.map(d => {
      let herb = plants.find(p => normalize(p.name) === normalize(d.name));
      if (!herb) { herb = newHerb(d.name.trim()); plants.push(herb); }
      return { plantId: herb.id, amount: d.amount.trim() };
    });
    if (new Set(ingredients.map(i => i.plantId)).size !== ingredients.length) { setFormError("Hay una hierba repetida en este tónico."); return; }
    const item: Preparation = { ...editor, image, name: text("name"), uses: splitTags(text("uses")), aliases: splitTags(text("aliases")), warnings: text("warnings"), notes: text("notes"), published: form.get("published") === "on", ingredients, instructions: text("instructions"), avoid: form.getAll("avoid").map(String) };
    const next = { ...catalog, plants, preparations: [...catalog.preparations.filter(p => p.id !== item.id), item] };
    if (await save(next)) setEditor(null);
  };
  const submitHerb = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!herbEditor || !catalog) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (catalog.plants.some(p => p.id !== herbEditor.id && normalize(p.name) === normalize(text("name")))) { setFormError("Ya existe una hierba con ese nombre. Editá su ficha."); return; }
    const item: Plant = { ...herbEditor, image, name: text("name"), scientificName: text("scientificName"), properties: text("properties"), uses: splitTags(text("uses")), aliases: splitTags(text("aliases")), warnings: text("warnings"), notes: text("notes"), published: true };
    if (await save({ ...catalog, plants: [...catalog.plants.filter(p => p.id !== item.id), item] })) setHerbEditor(null);
  };
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setLoginError("");
    const password = new FormData(event.currentTarget).get("password");
    try { await api("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); setAdmin(true); setCatalog(null); setRole("admin"); setTab("tonics"); setLogin(false); }
    catch (e) { setLoginError((e as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => {
    try { if (adminAccess) await api("/api/session", { method: "DELETE" }); setAdmin(false); setPreview(false); setTab("search"); setDetail(null); setHerbDetail(null); setQuery(""); setProfile([]); setRole(null); setCatalog(null); } catch (e) { setError((e as Error).message); }
  };
  const downloadCsv = () => {
    if (!catalog) return;
    const url = URL.createObjectURL(new Blob([exportTonics(catalog)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "tonicos-nekurel.csv" });
    link.click(); URL.revokeObjectURL(url);
  };
  const chooseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !catalog) return;
    if (file.size > 1_500_000) { setError("El archivo es demasiado grande."); return; }
    setFormError(""); setReport(importTonics(catalog, await file.text()));
  };

  const searchedCatalog = catalog && preview && admin ? { ...catalog, preparations: catalog.preparations.map(p => ({ ...p, published: true })) } : catalog;
  const searchResults = searchedCatalog ? searchCatalog(searchedCatalog, query) : { preparations: [], plants: [] };
  const found = searchResults.preparations;
  const searching = query.trim().length > 0;
  const byUsage = searching ? found : [...found].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, "es"));
  const isFlagged = (p: Preparation) => (p.avoid ?? []).some(id => profile.includes(id));
  const ordered = profile.length ? [...byUsage.filter(p => !isFlagged(p)), ...byUsage.filter(isFlagged)] : byUsage;
  const topIds = new Set(searching ? [] : byUsage.filter(p => (usage[p.id] ?? 0) > 0).slice(0, 3).map(p => p.id));
  const suggestions = [...new Set(["mate", ...(searchedCatalog ? searchCatalog(searchedCatalog, "") : { preparations: [] }).preparations.flatMap(p => p.uses)])].slice(0, 6);
  const herbOptions = (catalog?.plants ?? []).map(p => ({ id: p.id, name: p.name, tonics: catalog?.preparations.filter(t => t.ingredients.some(i => i.plantId === p.id)).length ?? 0 })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const matches = (name: string) => normalize(name).includes(normalize(filter));
  const setDraft = (index: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, n) => n === index ? { ...d, ...patch } : d));

  const inlineDetail = role === "seller" && desktop;
  const screenOpen = Boolean(login || (editor && admin) || (herbEditor && admin) || (!inlineDetail && (detail || herbDetail)) || (deleting && admin) || (report && admin));
  return <>
  {!role && <div className="role-entry" inert={screenOpen}>
    <div className="entry-brand"><Leaf size={26} weight="fill" aria-hidden="true" /><span>Ñekurel</span></div>
    <div className="entry-content"><p className="entry-kicker">BIBLIOTECA BOTÁNICA</p><h1>¿Cómo querés entrar?</h1><p className="entry-intro">El conocimiento de la casa, a mano.</p>
      <div className="role-options"><button className="role-card" onClick={() => { setCatalog(null); setRole("seller"); setTab("search"); setPreview(false); }}><span className="role-icon"><Storefront size={28} aria-hidden="true" /></span><strong>Vendedor</strong><span>Buscar hierbas y tónicos.<br />Consultar y compartir preparados.</span><span className="role-action">Entrar al catálogo <ArrowRight size={20} aria-hidden="true" /></span></button>
      <button className="role-card" onClick={() => { if (adminAccess) { setCatalog(null); setRole("admin"); setTab("tonics"); } else { setLoginError(""); setLogin(true); } }}><span className="role-icon"><LockKey size={28} aria-hidden="true" /></span><strong>Administrador</strong><span>Cargar el conocimiento.<br />Gestionar hierbas y recetas.</span><span className="role-action">Administrar <ArrowRight size={20} aria-hidden="true" /></span></button></div>
      {error && <div className="alert error" role="alert">{error}<button onClick={() => void load()}>Reintentar</button></div>}
    </div><p className="entry-footer">Herboristería · Conocimiento compartido</p>
  </div>}
  {role && <div className={`app ${admin ? "admin-app" : "seller-app"}`} inert={screenOpen}>
    <main>
      {admin && <div className="admin-access"><button onClick={() => void logout()}><ArrowLeft size={18} aria-hidden="true" />Cambiar rol</button><span>Administración</span></div>}
      {admin && <nav className="segmented" aria-label="Secciones">{(Object.keys(labels) as Tab[]).map(item => <button key={item} aria-current={tab === item ? "page" : undefined} onClick={() => { setTab(item); setFilter(""); setNotice(""); }}>{labels[item]}</button>)}</nav>}
      {!online && <div className="alert offline" role="status"><WifiSlash size={22} weight="bold" aria-hidden="true" />Sin conexión. Se muestra la última versión guardada.</div>}
      {error && <div className="alert error" role="alert">{error}<button onClick={() => void load()}>Reintentar</button></div>}
      {notice && <div className="alert success" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={22} weight="bold" aria-hidden="true" /></button></div>}
      {tab === "search" && <>
        {admin && <div className="preview-bar"><span>{preview ? "Vista previa: incluye borradores." : "El equipo solo ve tónicos habilitados."}</span><button onClick={() => { setPreview(!preview); setQuery(""); }}>{preview ? "Salir de vista previa" : "Ver borradores"}</button></div>}
        <div className={role === "seller" ? "seller-workspace" : undefined}><Finder selectedId={detail?.id ?? herbDetail?.id} catalog={catalog} query={query} onQuery={setQuery} results={ordered} herbs={searchResults.plants} onOpenHerb={plant => { setDetail(null); setHerbDetail(plant); }} suggestions={suggestions} plantName={plantName} isDraft={id => preview && !catalog?.preparations.find(p => p.id === id)?.published} onOpen={openDetail} profile={profile} onProfile={setProfile} topIds={topIds} onExit={() => void logout()} />{inlineDetail && <aside className="seller-detail" aria-label="Detalle de la ficha">{detail ? <TonicDetail key={detail.id} prep={detail} catalog={catalog} plantName={plantName} preview={false} profile={profile} onClose={() => setDetail(null)} inline /> : herbDetail ? <HerbDetail key={herbDetail.id} plant={herbDetail} onClose={() => setHerbDetail(null)} inline /> : <div className="detail-placeholder"><Leaf size={44} weight="duotone" aria-hidden="true" /><h2>Elegí una ficha</h2><p>Seleccioná un tónico o una hierba del catálogo para consultar sus ingredientes, usos y preparación.</p></div>}</aside>}</div>
      </>}
      {admin && tab === "tonics" && <section className="admin-region">
        <div className="admin-title"><h1>Tónicos</h1><button className="button primary" onClick={() => openEditor(blankTonic())}><Plus size={20} weight="bold" aria-hidden="true" />Nuevo tónico</button></div>
        <div className="catalog-toolbar"><label><MagnifyingGlass size={22} weight="bold" aria-hidden="true" /><input value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar tónicos" placeholder="Buscar un tónico" /></label><button className="button" onClick={() => void load()}>Actualizar</button></div>
        <div className="toolbar-actions">
          <label className="button"><UploadSimple size={20} weight="bold" aria-hidden="true" />Importar CSV<input type="file" accept=".csv,text/csv" hidden onChange={e => void chooseCsv(e)} /></label>
          <button className="button" onClick={downloadCsv}><DownloadSimple size={20} weight="bold" aria-hidden="true" />Exportar CSV</button>
        </div>
        <div className="catalog-list">{catalog?.preparations.filter(p => matches(p.name)).sort((a, b) => a.name.localeCompare(b.name, "es")).map(item => <article key={item.id} className="catalog-row"><CatalogImage image={item.image} name={item.name} className="row-image" /><div className="row-main"><h3>{item.name}</h3><p>{item.ingredients.map(i => plantName(i.plantId)).join(", ")}</p></div><span className={`status ${item.published ? "published" : "draft"}`}>{item.published ? "Habilitado" : "Borrador"}</span><div className="row-actions"><button className="button" onClick={() => openEditor(item)}>Editar</button><button className="icon-button danger-text" aria-label={`Eliminar ${item.name}`} onClick={() => { setFormError(""); setDeleting(item); }}><Trash size={24} aria-hidden="true" /></button></div></article>)}</div>
        {catalog && !catalog.preparations.some(p => matches(p.name)) && <div className="empty"><h3>{filter ? "No encontramos ese tónico" : "Todavía no hay tónicos"}</h3><p>{filter ? "Probá con otro nombre." : "Creá un tónico o importá varios desde un archivo CSV."}</p></div>}
      </section>}
      {admin && tab === "herbs" && <section className="admin-region">
        <div className="admin-title"><h1>Hierbas</h1><button className="button primary" onClick={() => openHerbEditor(newHerb(""))}><Plus size={20} weight="bold" aria-hidden="true" />Nueva hierba</button></div>
        <p className="section-note">Cargá imágenes, usos y búsquedas como mate. Las hierbas se pueden consultar por separado o usar en tónicos.</p>
        <div className="catalog-toolbar"><label><MagnifyingGlass size={22} weight="bold" aria-hidden="true" /><input value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar hierbas" placeholder="Buscar una hierba" /></label></div>
        <div className="catalog-list">{[...herbOptions].sort((a, b) => b.tonics - a.tonics || a.name.localeCompare(b.name, "es")).filter(h => matches(h.name)).map(herb => <article key={herb.id} className="catalog-row herb-row">
          <CatalogImage image={catalog?.plants.find(p => p.id === herb.id)?.image} name={herb.name} className="row-image" />
          <div className="row-main"><h3>{herb.name}</h3><div className="tonic-chips">{(catalog?.preparations ?? []).filter(t => t.ingredients.some(i => i.plantId === herb.id)).map(t => <button key={t.id} className="chip small" onClick={() => openEditor(t)}>{t.name}</button>)}</div></div>
          <span className="status published">{herb.tonics === 1 ? "1 tónico" : `${herb.tonics} tónicos`}</span>
          <button className="button" onClick={() => { const plant = catalog?.plants.find(p => p.id === herb.id); if (plant) openHerbEditor(plant); }}>Editar hierba</button>
        </article>)}</div>
        {catalog && !herbOptions.some(h => matches(h.name)) && <div className="empty"><h3>{filter ? "No encontramos esa hierba" : "Todavía no hay hierbas"}</h3><p>{filter ? "Probá con otro nombre." : "Creá una hierba o agregala al armar un tónico."}</p></div>}
      </section>}
    </main>
  </div>}
    {login && <Screen title="Administración de Ñekurel" onClose={() => { if (!busy) setLogin(false); }}><p className="screen-intro">Ingresá para gestionar los tónicos. El equipo puede consultar sin iniciar sesión.</p><form onSubmit={submitLogin}><label className="field"><span>Contraseña de administrador</span><input name="password" type="password" required autoComplete="current-password" autoFocus maxLength={512} /></label>{loginError && <div className="alert error" role="alert">{loginError}</div>}<button className="button primary full" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button></form></Screen>}
    {editor && admin && <Screen title={editor.name ? `Editar ${editor.name}` : "Nuevo tónico"} onClose={() => { if (!busy) setEditor(null); }}>
      <form onSubmit={submitEditor}>
        <Field label="Nombre del tónico" name="name" value={editor.name} required />
        <ImageField value={image} onChange={setImage} onBusy={setBusy} />
        <div className="form-grid">
          <Field label="Se utiliza para" name="uses" value={editor.uses.join(", ")} multiline hint="Separá cada uso con una coma: gases, pesadez, descanso." />
          <Field label="También buscar por" name="aliases" value={editor.aliases.join(", ")} multiline hint="Sinónimos y expresiones del cliente: hinchazón, dolor de panza." />
        </div>
        <fieldset className="ingredients-editor"><legend>Hierbas y proporciones</legend>
          <p>Escribí el nombre y elegí una hierba existente. Si no está, se agrega sola. Con proporciones como &quot;2 partes&quot; el empleado puede calcular gramos.</p>
          {drafts.map((draft, index) => <div className="ingredient-row" key={index}>
            <HerbCombobox label={`Hierba ${index + 1}`} value={draft.name} onChange={name => setDraft(index, { name })} options={herbOptions} taken={new Set(drafts.filter((_, n) => n !== index).map(d => normalize(d.name)))} />
            <input aria-label={`Proporción ${index + 1}`} placeholder="Ej.: 2 partes" value={draft.amount} maxLength={1000} onChange={e => setDraft(index, { amount: e.target.value })} />
            <button type="button" className="icon-button" aria-label={`Quitar hierba ${index + 1}`} onClick={() => setDrafts(drafts.filter((_, n) => n !== index))}><X size={22} weight="bold" aria-hidden="true" /></button>
          </div>)}
          <button className="button" type="button" onClick={() => setDrafts([...drafts, { name: "", amount: "" }])}><Plus size={20} weight="bold" aria-hidden="true" />Agregar hierba</button>
        </fieldset>
        <Field label="Preparación e indicaciones internas" name="instructions" value={editor.instructions} multiline hint="Escribí el método y los tiempos definidos por el dueño." />
        <Field label="Advertencias / contraindicaciones" name="warnings" value={editor.warnings} multiline />
        <fieldset className="ingredients-editor"><legend>No recomendado en</legend>
          <p>El empleado puede indicar la situación del cliente y estos tónicos se marcan para evitarlos.</p>
          <div className="check-grid">{avoidOptions.map(o => <label key={o.id} className="check"><input type="checkbox" name="avoid" value={o.id} defaultChecked={editor.avoid?.includes(o.id)} />{o.label}</label>)}</div>
        </fieldset>
        <Field label="Notas internas" name="notes" value={editor.notes} multiline rows={2} />
        <label className="publish-control"><input type="checkbox" name="published" defaultChecked={editor.published} /><span><strong>Habilitar para el equipo</strong><small>Confirmo que revisé los usos, las advertencias y la información de este tónico.</small></span></label>
        {formError && <div className="alert error" role="alert">{formError}</div>}
        <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando…" : "Guardar tónico"}</button></div>
      </form>
    </Screen>}
    {herbEditor && admin && <Screen title={herbEditor.name ? `Editar ${herbEditor.name}` : "Nueva hierba"} onClose={() => { if (!busy) setHerbEditor(null); }}><form onSubmit={submitHerb}>
      <Field label="Nombre de la hierba" name="name" value={herbEditor.name} required />
      <ImageField value={image} onChange={setImage} onBusy={setBusy} />
      <Field label="Nombre científico" name="scientificName" value={herbEditor.scientificName} />
      <Field label="Propiedades" name="properties" value={herbEditor.properties} multiline />
      <Field label="Usos tradicionales y formas de uso" name="uses" value={herbEditor.uses.join(", ")} multiline hint="Separá por comas. Ejemplos: mate, infusión, sobremesa." />
      <Field label="También buscar por" name="aliases" value={herbEditor.aliases.join(", ")} multiline hint="Sinónimos o búsquedas del cliente. Ejemplo: hierbas para mate." />
      <Field label="Advertencias / contraindicaciones" name="warnings" value={herbEditor.warnings} multiline />
      <Field label="Notas internas" name="notes" value={herbEditor.notes} multiline />
      {formError && <div className="alert error" role="alert">{formError}</div>}
      <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setHerbEditor(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando…" : "Guardar hierba"}</button></div>
    </form></Screen>}
    {report && admin && <Screen title="Importar tónicos" onClose={() => { if (!busy) setReport(null); }}>
      {report.created + report.updated > 0 ? <p className="screen-intro">Se van a crear <strong>{report.created}</strong> tónicos y actualizar <strong>{report.updated}</strong>. Los tónicos se identifican por su nombre.</p> : <p className="screen-intro">No hay nada para importar.</p>}
      {report.drafts.length > 0 && <div className="alert warn"><span>Quedan como borrador por estar incompletos (faltan usos, preparación o proporciones): {report.drafts.join(", ")}.</span></div>}
      {report.errors.length > 0 && <div className="alert error" role="alert"><ul>{report.errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
      <p className="section-note">Columnas: Nombre, Usos, Sinónimos, Hierbas (como Manzanilla:2 partes|Menta:1 parte), Preparación, Advertencias, Notas, No recomendado en, Habilitado. Exportá el catálogo para ver un ejemplo.</p>
      {formError && <div className="alert error" role="alert">{formError}</div>}
      <div className="form-actions"><button className="button" disabled={busy} onClick={() => setReport(null)}>Cancelar</button>{report.created + report.updated > 0 && <button className="button primary" disabled={busy} onClick={async () => { if (await save(report.catalog)) setReport(null); }}>{busy ? "Importando…" : "Confirmar importación"}</button>}</div>
    </Screen>}
    {!inlineDetail && detail && <TonicDetail key={detail.id} prep={detail} catalog={catalog} plantName={plantName} preview={preview} profile={profile} onClose={() => setDetail(null)} onEdit={admin ? () => { openEditor(detail); setDetail(null); } : undefined} />}
    {!inlineDetail && herbDetail && <HerbDetail plant={herbDetail} onClose={() => setHerbDetail(null)} onEdit={admin ? () => { openHerbEditor(herbDetail); setHerbDetail(null); } : undefined} />}
    {deleting && admin && <Screen title={`Eliminar ${deleting.name}`} onClose={() => { if (!busy) setDeleting(null); }}>
      <p className="screen-intro">Este tónico se eliminará del catálogo. La eliminación no se puede deshacer.</p>
      {formError && <div className="alert error" role="alert">{formError}</div>}
      <div className="form-actions"><button className="button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="button danger" disabled={busy} onClick={async () => { if (!catalog) return; if (await save({ ...catalog, preparations: catalog.preparations.filter(p => p.id !== deleting.id) })) setDeleting(null); }}>{busy ? "Eliminando…" : "Eliminar tónico"}</button></div>
    </Screen>}
  </>;
}
