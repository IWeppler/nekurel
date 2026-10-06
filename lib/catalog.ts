export type Plant = {
  id: string; name: string; scientificName: string; properties: string;
  uses: string[]; aliases: string[]; warnings: string; notes: string; published: boolean;
  image?: string;
  categoryIds?: string[];
};
export type Preparation = {
  id: string; name: string; uses: string[]; aliases: string[];
  ingredients: { plantId: string; amount: string }[];
  instructions: string; warnings: string; notes: string; published: boolean;
  image?: string;
  categoryIds?: string[];
  /** Situations in which this tonic is not recommended (see avoidOptions). */
  avoid?: string[];
};
export const categoryOptions = [
  { id: "mate", label: "Mate", query: "mate", kind: "herbs", position: "0%" },
  { id: "herbs", label: "Hierbas", query: "", kind: "herbs", position: "100%" },
  { id: "tonics", label: "Tónicos", query: "", kind: "tonics", position: "50%" },
] as const;
export type Category = { id: string; label: string };
export type CategoryImages = Record<string, string>;
export const getCategories = (catalog: Catalog | null): Category[] => catalog?.categories ?? categoryOptions.map(({ id, label }) => ({ id, label }));
export function itemCategories(item: Plant | Preparation): string[] {
  if (item.categoryIds !== undefined) return item.categoryIds;
  if ("ingredients" in item) return ["tonics"];
  return ["herbs", ...([...item.uses, ...item.aliases].some(term => normalize(term).includes("mate")) ? ["mate"] : [])];
}
export type Catalog = { plants: Plant[]; preparations: Preparation[]; revision: number; categoryImages?: CategoryImages; categories?: Category[] };

export const avoidOptions = [
  { id: "embarazo", label: "Embarazo" },
  { id: "lactancia", label: "Lactancia" },
  { id: "ninos", label: "Niños pequeños" },
  { id: "medicacion", label: "Toma medicación" },
] as const;
export function getAvoidOptions(catalog: Catalog | null): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [...avoidOptions];
  for (const prep of catalog?.preparations ?? []) for (const id of prep.avoid ?? []) {
    if (!options.some(option => normalize(option.id) === normalize(id))) options.push({ id, label: id });
  }
  return options;
}
export type AvoidId = (typeof avoidOptions)[number]["id"];

export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const stopWords = new Set(["de", "del", "la", "el", "los", "las", "para", "por", "un", "una", "y", "con", "me", "tengo"]);
export function relevance(item: { name: string; uses: string[]; aliases: string[] }, query: string, extra: string[] = []) {
  const q = normalize(query);
  if (!q) return 1;
  const terms = q.split(" ").filter(word => !stopWords.has(word));
  if (!terms.length) return 0;
  const fields = [item.name, ...item.uses, ...item.aliases, ...extra].map(normalize);
  if (fields.includes(q)) return 100;
  if (fields.some(field => field.includes(q))) return 70;
  return fields.some(field => terms.every(term => field.split(" ").some(word => word.startsWith(term)))) ? 40 : 0;
}
export function searchCatalog(catalog: Catalog, query: string) {
  const plants = catalog.plants;
  const herbName = (id: string) => plants.find(p => p.id === id)?.name ?? "";
  const rank = <T extends { name: string; uses: string[]; aliases: string[] }>(items: T[], extra: (item: T) => string[] = () => []) => items.map(item => ({ item, score: relevance(item, query, extra(item)) })).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "es")).map(result => result.item);
  const preparations = rank(catalog.preparations.filter(p => p.published && p.ingredients.every(i => plants.some(plant => plant.id === i.plantId))), p => p.ingredients.map(i => herbName(i.plantId)));
  const relatedIds = new Set(preparations.flatMap(p => p.ingredients.map(i => i.plantId)));
  const related = rank(plants, p => [p.scientificName, p.properties]);
  return { preparations, plants: [...related, ...plants.filter(p => relatedIds.has(p.id) && !related.some(match => match.id === p.id))] };
}

const plant = (n: number, name: string, scientificName: string, properties: string, uses: string[], aliases: string[], warnings: string): Plant => ({ id: `plant-${n}`, name, scientificName, properties, uses, aliases, warnings, notes: "Ficha inicial de ejemplo. El dueño puede ajustarla desde el panel.", published: true });
const generalWarning = "No recomendado en embarazo ni lactancia sin consultar. Consultar antes si la persona toma medicación o tiene una condición de salud. Si los síntomas persisten, derivar a un profesional.";
const method = "Mezclar las hierbas secas respetando las proporciones. Infusionar 1 cucharada sopera de mezcla en 200 ml de agua recién hervida, tapar entre 5 y 8 minutos y colar.";
const tonic = (n: number, name: string, uses: string[], aliases: string[], ingredients: [number, string][], avoid: AvoidId[], warnings = generalWarning): Preparation => ({ id: `prep-${n}`, name, uses, aliases, ingredients: ingredients.map(([id, amount]) => ({ plantId: `plant-${id}`, amount })), instructions: method, warnings, notes: "Tónico inicial de ejemplo. El dueño debe confirmar proporciones y tiempos.", published: true, avoid });

export const seedCatalog: Catalog = {
  revision: 0,
  plants: [
    plant(1, "Manzanilla", "Matricaria chamomilla", "Digestiva y suave. De uso tradicional para calmar molestias del estómago.", ["gases", "digestión lenta", "cólicos leves"], ["té de manzanilla"], "Puede causar alergia en personas sensibles a la margarita, el crisantemo o el ajenjo."),
    plant(2, "Menta", "Mentha piperita", "Aromática y refrescante. De uso tradicional para la digestión.", ["pesadez", "gases", "náuseas leves", "mate"], ["menta piperita", "hierbas para mate"], "Evitar si hay reflujo gástrico. No dar a niños pequeños."),
    plant(3, "Hinojo", "Foeniculum vulgare", "Carminativo. De uso tradicional para aliviar gases.", ["gases", "digestión lenta", "cólicos leves"], ["hinojo dulce"], "Evitar en embarazo. Puede causar alergia en personas sensibles al apio o la zanahoria."),
    plant(4, "Boldo", "Peumus boldus", "Amargo. De uso tradicional para las comidas abundantes y el hígado.", ["comidas pesadas", "digestión lenta", "hígado cargado"], ["boldo chileno"], "No usar en embarazo, lactancia ni con problemas de vesícula o vías biliares. No usar de forma prolongada."),
    plant(5, "Cedrón", "Aloysia citrodora", "Aromática y digestiva. De uso tradicional después de las comidas.", ["digestión lenta", "nervios", "gases", "mate"], ["hierba luisa", "hierbas para mate"], "Evitar en embarazo por falta de información suficiente."),
    plant(6, "Burrito", "Aloysia polystachya", "Aromática y digestiva. Muy usada en infusiones de sobremesa.", ["digestión lenta", "pesadez", "gases", "mate"], ["poleo", "peperina de burro", "hierbas para mate"], "Evitar en embarazo y lactancia por falta de información suficiente."),
    plant(7, "Valeriana", "Valeriana officinalis", "Relajante. De uso tradicional para conciliar el sueño.", ["insomnio", "nerviosismo", "dificultad para dormir"], ["raíz de valeriana"], "Puede dar somnolencia: no manejar luego de tomarla. No combinar con sedantes ni alcohol."),
    plant(8, "Pasiflora", "Passiflora incarnata", "Calmante. De uso tradicional para la inquietud nocturna.", ["insomnio", "ansiedad", "nerviosismo"], ["pasionaria", "flor de la pasión"], "Puede dar somnolencia. Evitar en embarazo y con sedantes."),
    plant(9, "Tilo", "Tilia cordata", "Suave y relajante. De uso tradicional en infusiones de la noche.", ["insomnio", "nervios", "resfrío"], ["flor de tilo"], "Consultar si hay problemas cardíacos."),
    plant(10, "Melisa", "Melissa officinalis", "Calmante suave. De uso tradicional para la tensión y el descanso.", ["ansiedad", "tensión nerviosa", "insomnio"], ["toronjil"], "Puede dar algo de somnolencia. Consultar si toma medicación para la tiroides."),
    plant(11, "Jengibre", "Zingiber officinale", "Estimulante y tibio. De uso tradicional para el estómago y el resfrío.", ["náuseas", "resfrío", "digestión lenta"], ["kion"], "Consultar si toma anticoagulantes o tiene problemas de vesícula. Evitar en gastritis."),
    plant(12, "Anís", "Pimpinella anisum", "Aromático y carminativo. De uso tradicional para la digestión.", ["gases", "digestión lenta"], ["anís verde"], "Evitar en embarazo. Puede causar alergia en personas sensibles al apio o la zanahoria."),
    plant(13, "Tomillo", "Thymus vulgaris", "Aromático. De uso tradicional para la garganta y las vías respiratorias.", ["tos", "dolor de garganta", "resfrío"], ["tomillo común"], "Evitar en embarazo en uso medicinal."),
    plant(14, "Eucalipto", "Eucalyptus globulus", "Balsámico. De uso tradicional para la congestión.", ["congestión", "tos", "resfrío"], ["eucalipto blanco"], "No dar a niños pequeños. No ingerir el aceite esencial. Evitar en embarazo."),
    plant(15, "Diente de león", "Taraxacum officinale", "Amargo y depurativo. De uso tradicional para el hígado y los líquidos.", ["retención de líquidos", "hígado cargado", "comidas pesadas"], ["taraxacum"], "No usar con obstrucción de vías biliares. Puede causar alergia en personas sensibles a la margarita. Consultar si toma diuréticos."),
    plant(16, "Cola de caballo", "Equisetum arvense", "Diurética. De uso tradicional para eliminar líquidos.", ["retención de líquidos", "piernas hinchadas"], ["equiseto"], "Evitar en embarazo y con problemas renales o cardíacos. No usar de forma prolongada."),
    plant(17, "Cardo mariano", "Silybum marianum", "De uso tradicional para acompañar al hígado.", ["hígado cargado", "comidas pesadas"], ["cardo de leche"], "Puede causar alergia en personas sensibles a la margarita. Evitar en embarazo."),
    plant(18, "Lavanda", "Lavandula angustifolia", "Aromática y relajante. De uso tradicional para la calma.", ["nervios", "ansiedad", "insomnio"], ["espliego"], "Puede dar somnolencia. Evitar en embarazo."),
    plant(19, "Equinácea", "Echinacea purpurea", "De uso tradicional para acompañar en épocas de resfríos.", ["defensas bajas", "resfrío"], ["flor del cono"], "No usar de forma prolongada. Evitar en enfermedades autoinmunes y con alergia a la margarita."),
  ],
  preparations: [
    tonic(1, "Tónico digestivo", ["gases", "pesadez", "digestión lenta", "dolor abdominal leve"], ["hinchazón", "dolor de panza", "panza hinchada", "indigestión", "empacho"], [[1, "2 partes"], [2, "1 parte"], [3, "1 parte"]], ["embarazo"]),
    tonic(2, "Tónico descanso", ["insomnio"], ["descanso", "dificultad para dormir", "no puedo dormir"], [[7, "1 parte"], [8, "1 parte"], [9, "2 partes"]], ["embarazo", "medicacion"]),
    tonic(3, "Tónico hepático", ["comidas pesadas", "hígado cargado"], ["después de un asado", "exceso de comida", "comí de más"], [[4, "1 parte"], [15, "2 partes"], [17, "1 parte"]], ["embarazo", "lactancia", "medicacion"]),
    tonic(4, "Tónico respiratorio", ["tos", "congestión", "dolor de garganta", "resfrío"], ["garganta irritada", "nariz tapada", "catarro", "gripe"], [[14, "1 parte"], [13, "2 partes"], [11, "1 parte"]], ["embarazo", "ninos"]),
    tonic(5, "Tónico depurativo", ["retención de líquidos", "piernas hinchadas"], ["tobillos hinchados", "diurético", "retengo líquido"], [[16, "2 partes"], [15, "2 partes"], [5, "1 parte"]], ["embarazo", "medicacion"]),
    tonic(6, "Tónico calma", ["ansiedad", "nervios", "tensión nerviosa"], ["estrés", "nervioso", "angustia", "tensión"], [[10, "2 partes"], [18, "1 parte"], [9, "1 parte"]], ["embarazo", "medicacion"]),
    tonic(7, "Tónico defensas", ["defensas bajas", "resfrío"], ["me enfermo seguido", "prevenir resfríos", "cambio de estación"], [[19, "2 partes"], [11, "1 parte"], [13, "1 parte"]], ["embarazo"]),
    tonic(8, "Tónico para después de comer", ["digestión después de comer", "gases"], ["sobremesa", "digestivo suave", "comida pesada"], [[6, "2 partes"], [5, "1 parte"], [12, "1 parte"]], ["embarazo", "lactancia"]),
  ],
};

export function validateCatalog(value: unknown): asserts value is Catalog {
  const fail = (message: string): never => { throw new Error(message); };
  if (!value || typeof value !== "object") fail("Catálogo inválido.");
  const data = value as Catalog;
  if (!Array.isArray(data.plants) || !Array.isArray(data.preparations) || !Number.isSafeInteger(data.revision) || data.revision < 0) fail("Catálogo inválido.");
  if (data.categories !== undefined) {
    if (!Array.isArray(data.categories) || !data.categories.length || data.categories.length > 50) fail("Categorías inválidas.");
    const categoryIds = new Set<string>(); const names = new Set<string>();
    for (const category of data.categories) {
      if (!category || typeof category.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(category.id) || typeof category.label !== "string" || !category.label.trim() || category.label.length > 100 || categoryIds.has(category.id) || names.has(normalize(category.label))) fail("Revisá las categorías: cada una debe tener un nombre distinto.");
      categoryIds.add(category.id); names.add(normalize(category.label));
    }
  }
  const categoryIds = new Set(getCategories(data).map(category => category.id));
  if (data.categoryImages !== undefined) {
    if (!data.categoryImages || typeof data.categoryImages !== "object" || Array.isArray(data.categoryImages)) fail("Imágenes de categorías inválidas.");
    for (const [id, image] of Object.entries(data.categoryImages)) {
      if (!categoryIds.has(id) || typeof image !== "string" || (image !== "" && !/^\/api\/images\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(image))) fail("Imagen de categoría inválida. Subí una imagen desde el administrador.");
    }
  }
  if (data.plants.length > 2000 || data.preparations.length > 2000) fail("El catálogo supera el límite de este MVP.");
  const string = (v: unknown, required = false) => { if (typeof v !== "string" || v.length > 10000 || (required && !v.trim())) fail("Revisá los campos obligatorios."); };
  const tags = (v: unknown) => { if (!Array.isArray(v) || v.length > 100) fail("Etiquetas inválidas."); for (const tag of v as unknown[]) string(tag, true); };
  const ids = new Set<string>();
  for (const item of [...data.plants, ...data.preparations]) {
    if (!item || typeof item !== "object") fail("Ficha inválida.");
    string(item.id, true); string(item.name, true); string(item.warnings); string(item.notes); tags(item.uses); tags(item.aliases);
    if (item.image !== undefined && (typeof item.image !== "string" || (item.image !== "" && !/^\/api\/images\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(item.image)))) fail("Imagen inválida. Subí una imagen desde el editor.");
    if (typeof item.published !== "boolean" || ids.has(item.id)) fail("Ficha inválida o identificador duplicado.");
    if (item.categoryIds !== undefined && (!Array.isArray(item.categoryIds) || item.categoryIds.length > 50 || item.categoryIds.some(id => typeof id !== "string" || !categoryIds.has(id)) || new Set(item.categoryIds).size !== item.categoryIds.length)) fail("Categorías de la ficha inválidas.");
    ids.add(item.id);
  }
  for (const plant of data.plants) { string(plant.scientificName); string(plant.properties); }
  for (const prep of data.preparations) {
    string(prep.instructions);
    if (prep.avoid !== undefined) { tags(prep.avoid); if (prep.avoid.some(a => a.length > 200) || new Set(prep.avoid.map(normalize)).size !== prep.avoid.length) fail("Datos de no recomendado inválidos."); }
    if (!Array.isArray(prep.ingredients) || !prep.ingredients.length || prep.ingredients.length > 100) fail("Elegí al menos una planta.");
    const seen = new Set<string>();
    for (const ingredient of prep.ingredients) {
      if (!ingredient || !data.plants.some(p => p.id === ingredient.plantId) || seen.has(ingredient.plantId)) fail("El preparado contiene plantas inválidas o repetidas.");
      seen.add(ingredient.plantId); string(ingredient.amount);
    }
    if (prep.published && (!prep.instructions.trim() || !prep.uses.length || prep.ingredients.some(i => !i.amount.trim()))) fail("Completá usos, preparación y proporciones del tónico.");
  }
}
