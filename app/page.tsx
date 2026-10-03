"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { DownloadSimple, Leaf, MagnifyingGlass, Plus, Trash, UploadSimple, WifiSlash, X } from "@phosphor-icons/react";
import { Finder, TonicDetail } from "./finder";
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
/* Herbs are created from the tonic form. Drop the blank ones that no tonic uses anymore. */
const pruneHerbs = (catalog: Catalog): Catalog => {
  const used = new Set(catalog.preparations.flatMap(p => p.ingredients.map(i => i.plantId)));
  return { ...catalog, plants: catalog.plants.filter(p => used.has(p.id) || p.warnings || p.uses.length || p.properties) };
};

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
  const [admin, setAdmin] = useState(false);
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
      const data = await api<Catalog>("/api/catalog");
      setAdmin(session.admin); setCatalog(data); setError(""); if (!session.admin) { setTab("search"); setPreview(false); }
      setUsage(await api<Record<string, number>>("/api/usage").catch(() => ({})));
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => {
    const refresh = () => { if (!editor && !deleting && !login && !busy && !report) void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [load, editor, deleting, login, busy, report]);
  const plantName = useCallback((id: string) => catalog?.plants.find(p => p.id === id)?.name || "Hierba no disponible", [catalog]);
  const openEditor = (tonic: Preparation) => { setEditor(tonic); setFormError(""); setDrafts(tonic.ingredients.map(i => ({ name: plantName(i.plantId), amount: i.amount }))); };
  const openDetail = (prep: Preparation) => {
    setDetail(prep);
    if (admin) return;
    setUsage(u => ({ ...u, [prep.id]: (u[prep.id] ?? 0) + 1 }));
    void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: prep.id }) }).catch(() => undefined);
  };
  const save = async (next: Catalog) => {
    setBusy(true); setFormError("");
    try { const saved = await api<Catalog>("/api/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pruneHerbs(next)) }); setCatalog(saved); setNotice("Cambios guardados en el catálogo."); return true; }
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
    const item: Preparation = { ...editor, name: text("name"), uses: splitTags(text("uses")), aliases: splitTags(text("aliases")), warnings: text("warnings"), notes: text("notes"), published: form.get("published") === "on", ingredients, instructions: text("instructions"), avoid: form.getAll("avoid").map(String) };
    const next = { ...catalog, plants, preparations: [...catalog.preparations.filter(p => p.id !== item.id), item] };
    if (await save(next)) setEditor(null);
  };
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setLoginError("");
    const password = new FormData(event.currentTarget).get("password");
    try { await api("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); await load(); setLogin(false); }
    catch (e) { setLoginError((e as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => {
    try { await api("/api/session", { method: "DELETE" }); setAdmin(false); setPreview(false); setTab("search"); setDetail(null); await load(); } catch (e) { setError((e as Error).message); }
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
  const found = searchedCatalog ? searchCatalog(searchedCatalog, query).preparations : [];
  const searching = query.trim().length > 0;
  const byUsage = searching ? found : [...found].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, "es"));
  const isFlagged = (p: Preparation) => (p.avoid ?? []).some(id => profile.includes(id));
  const ordered = profile.length ? [...byUsage.filter(p => !isFlagged(p)), ...byUsage.filter(isFlagged)] : byUsage;
  const topIds = new Set(searching ? [] : byUsage.filter(p => (usage[p.id] ?? 0) > 0).slice(0, 3).map(p => p.id));
  const suggestions = [...new Set((searchedCatalog ? searchCatalog(searchedCatalog, "") : { preparations: [] }).preparations.flatMap(p => p.uses))].slice(0, 6);
  const herbOptions = (catalog?.plants ?? []).map(p => ({ id: p.id, name: p.name, tonics: catalog?.preparations.filter(t => t.ingredients.some(i => i.plantId === p.id)).length ?? 0 })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const matches = (name: string) => normalize(name).includes(normalize(filter));
  const setDraft = (index: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, n) => n === index ? { ...d, ...patch } : d));

  const screenOpen = Boolean(login || (editor && admin) || detail || (deleting && admin) || (report && admin));
  return <>
  <div className="app" inert={screenOpen}>
    <header className="topbar">
      <span className="wordmark"><span className="wordmark-mark" aria-hidden="true"><Leaf size={20} weight="fill" /></span>Ñekurel</span>
      <button className="pill-button" onClick={() => { if (admin) void logout(); else { setLoginError(""); setLogin(true); } }}>{admin ? "Salir" : "Administrar"}</button>
    </header>
    <main>
      {admin && <nav className="segmented" aria-label="Secciones">{(Object.keys(labels) as Tab[]).map(item => <button key={item} aria-current={tab === item ? "page" : undefined} onClick={() => { setTab(item); setFilter(""); setNotice(""); }}>{labels[item]}</button>)}</nav>}
      {!online && <div className="alert offline" role="status"><WifiSlash size={22} weight="bold" aria-hidden="true" />Sin conexión. Se muestra la última versión guardada.</div>}
      {error && <div className="alert error" role="alert">{error}<button onClick={() => void load()}>Reintentar</button></div>}
      {notice && <div className="alert success" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={22} weight="bold" aria-hidden="true" /></button></div>}
      {tab === "search" && <>
        {admin && <div className="preview-bar"><span>{preview ? "Vista previa: incluye borradores." : "El equipo solo ve tónicos habilitados."}</span><button onClick={() => { setPreview(!preview); setQuery(""); }}>{preview ? "Salir de vista previa" : "Ver borradores"}</button></div>}
        <Finder catalog={catalog} query={query} onQuery={setQuery} results={ordered} suggestions={suggestions} plantName={plantName} isDraft={id => preview && !catalog?.preparations.find(p => p.id === id)?.published} onOpen={openDetail} profile={profile} onProfile={setProfile} topIds={topIds} />
      </>}
      {admin && tab === "tonics" && <section className="admin-region">
        <div className="admin-title"><h1>Tónicos</h1><button className="button primary" onClick={() => openEditor(blankTonic())}><Plus size={20} weight="bold" aria-hidden="true" />Nuevo tónico</button></div>
        <div className="catalog-toolbar"><label><MagnifyingGlass size={22} weight="bold" aria-hidden="true" /><input value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar tónicos" placeholder="Buscar un tónico" /></label><button className="button" onClick={() => void load()}>Actualizar</button></div>
        <div className="toolbar-actions">
          <label className="button"><UploadSimple size={20} weight="bold" aria-hidden="true" />Importar CSV<input type="file" accept=".csv,text/csv" hidden onChange={e => void chooseCsv(e)} /></label>
          <button className="button" onClick={downloadCsv}><DownloadSimple size={20} weight="bold" aria-hidden="true" />Exportar CSV</button>
        </div>
        <div className="catalog-list">{catalog?.preparations.filter(p => matches(p.name)).sort((a, b) => a.name.localeCompare(b.name, "es")).map(item => <article key={item.id} className="catalog-row"><div className="row-main"><h3>{item.name}</h3><p>{item.ingredients.map(i => plantName(i.plantId)).join(", ")}</p></div><span className={`status ${item.published ? "published" : "draft"}`}>{item.published ? "Habilitado" : "Borrador"}</span><div className="row-actions"><button className="button" onClick={() => openEditor(item)}>Editar</button><button className="icon-button danger-text" aria-label={`Eliminar ${item.name}`} onClick={() => { setFormError(""); setDeleting(item); }}><Trash size={24} aria-hidden="true" /></button></div></article>)}</div>
        {catalog && !catalog.preparations.some(p => matches(p.name)) && <div className="empty"><h3>{filter ? "No encontramos ese tónico" : "Todavía no hay tónicos"}</h3><p>{filter ? "Probá con otro nombre." : "Creá un tónico o importá varios desde un archivo CSV."}</p></div>}
      </section>}
      {admin && tab === "herbs" && <section className="admin-region">
        <div className="admin-title"><h1>Hierbas</h1></div>
        <p className="section-note">Cuántos tónicos usan cada hierba. Se crean solas al armar un tónico.</p>
        <div className="catalog-toolbar"><label><MagnifyingGlass size={22} weight="bold" aria-hidden="true" /><input value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar hierbas" placeholder="Buscar una hierba" /></label></div>
        <div className="catalog-list">{[...herbOptions].sort((a, b) => b.tonics - a.tonics || a.name.localeCompare(b.name, "es")).filter(h => matches(h.name)).map(herb => <article key={herb.id} className="catalog-row herb-row">
          <div className="row-main"><h3>{herb.name}</h3><div className="tonic-chips">{(catalog?.preparations ?? []).filter(t => t.ingredients.some(i => i.plantId === herb.id)).map(t => <button key={t.id} className="chip small" onClick={() => openEditor(t)}>{t.name}</button>)}</div></div>
          <span className="status published">{herb.tonics === 1 ? "1 tónico" : `${herb.tonics} tónicos`}</span>
        </article>)}</div>
        {catalog && !herbOptions.some(h => matches(h.name)) && <div className="empty"><h3>{filter ? "No encontramos esa hierba" : "Todavía no hay hierbas"}</h3><p>{filter ? "Probá con otro nombre." : "Aparecen cuando armás un tónico."}</p></div>}
      </section>}
    </main>
  </div>
    {login && <Screen title="Administración de Ñekurel" onClose={() => { if (!busy) setLogin(false); }}><p className="screen-intro">Ingresá para gestionar los tónicos. El equipo puede consultar sin iniciar sesión.</p><form onSubmit={submitLogin}><label className="field"><span>Contraseña de administrador</span><input name="password" type="password" required autoComplete="current-password" autoFocus maxLength={512} /></label>{loginError && <div className="alert error" role="alert">{loginError}</div>}<button className="button primary full" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button></form></Screen>}
    {editor && admin && <Screen title={editor.name ? `Editar ${editor.name}` : "Nuevo tónico"} onClose={() => { if (!busy) setEditor(null); }}>
      <form onSubmit={submitEditor}>
        <Field label="Nombre del tónico" name="name" value={editor.name} required />
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
    {report && admin && <Screen title="Importar tónicos" onClose={() => { if (!busy) setReport(null); }}>
      {report.created + report.updated > 0 ? <p className="screen-intro">Se van a crear <strong>{report.created}</strong> tónicos y actualizar <strong>{report.updated}</strong>. Los tónicos se identifican por su nombre.</p> : <p className="screen-intro">No hay nada para importar.</p>}
      {report.drafts.length > 0 && <div className="alert warn"><span>Quedan como borrador por estar incompletos (faltan usos, preparación o proporciones): {report.drafts.join(", ")}.</span></div>}
      {report.errors.length > 0 && <div className="alert error" role="alert"><ul>{report.errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
      <p className="section-note">Columnas: Nombre, Usos, Sinónimos, Hierbas (como Manzanilla:2 partes|Menta:1 parte), Preparación, Advertencias, Notas, No recomendado en, Habilitado. Exportá el catálogo para ver un ejemplo.</p>
      {formError && <div className="alert error" role="alert">{formError}</div>}
      <div className="form-actions"><button className="button" disabled={busy} onClick={() => setReport(null)}>Cancelar</button>{report.created + report.updated > 0 && <button className="button primary" disabled={busy} onClick={async () => { if (await save(report.catalog)) setReport(null); }}>{busy ? "Importando…" : "Confirmar importación"}</button>}</div>
    </Screen>}
    {detail && <TonicDetail prep={detail} catalog={catalog} plantName={plantName} preview={preview} profile={profile} onClose={() => setDetail(null)} onEdit={admin ? () => { openEditor(detail); setDetail(null); } : undefined} />}
    {deleting && admin && <Screen title={`Eliminar ${deleting.name}`} onClose={() => { if (!busy) setDeleting(null); }}>
      <p className="screen-intro">Este tónico se eliminará del catálogo. La eliminación no se puede deshacer.</p>
      {formError && <div className="alert error" role="alert">{formError}</div>}
      <div className="form-actions"><button className="button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="button danger" disabled={busy} onClick={async () => { if (!catalog) return; if (await save({ ...catalog, preparations: catalog.preparations.filter(p => p.id !== deleting.id) })) setDeleting(null); }}>{busy ? "Eliminando…" : "Eliminar tónico"}</button></div>
    </Screen>}
  </>;
}
