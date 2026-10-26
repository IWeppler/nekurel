import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, searchCatalog, validateCatalog, relevance } from '../lib/catalog.ts';
import { exportTonics, importTonics } from '../lib/csv.ts';
import { formatPrice, slugify, assignSlugs, effectivePrice, storeToday, storeCategory, isInStore, isComboInStore, brokenCombos, combosUsing, comboSavings } from '../lib/catalog.ts';
import { recipeText } from '../lib/recipe.ts';

function activeCatalog() {
  const catalog = structuredClone(seedCatalog);
  catalog.plants = catalog.plants.map(p => ({ ...p, published: true, uses: ['uso de prueba'] }));
  catalog.preparations = catalog.preparations.map(p => ({ ...p, published: true, instructions: 'Instrucción de prueba', ingredients: p.ingredients.map(i => ({ ...i, amount: i.amount || '1 parte' })) }));
  return catalog;
}
test('sinónimos y tildes encuentran preparados y sus ingredientes', () => {
  const result = searchCatalog(activeCatalog(), 'HINCHAZÓN');
  assert.deepEqual(result.preparations.map(p => p.name), ['Tónico digestivo']);
  assert.deepEqual(result.plants.map(p => p.name), ['Manzanilla', 'Menta', 'Hinojo']);
});
test('frases cotidianas y prefijos encuentran la mezcla cargada', () => {
  for (const query of ['dolor de panza', 'tengo dolor de panza', 'digestion', 'empacho']) {
    assert.equal(searchCatalog(activeCatalog(), query).preparations[0]?.name, 'Tónico digestivo');
  }
});
test('no inventa resultados por compartir una sola palabra', () => {
  assert.equal(searchCatalog(activeCatalog(), 'dolor de cabeza').preparations.length, 0);
  assert.equal(relevance({ name: 'Tilo', uses: [], aliases: [] }, 'de'), 0);
});
test('las fichas iniciales son válidas y los tónicos llegan al equipo', () => {
  validateCatalog(seedCatalog);
  const visible = searchCatalog(seedCatalog, '');
  assert.equal(visible.preparations.length, seedCatalog.preparations.length);
  assert.ok(visible.preparations.length >= 8);
});
test('las hierbas nuevas, sin usos ni advertencias, no bloquean un tónico', () => {
  const catalog = activeCatalog();
  catalog.plants.push({ id: 'plant-nueva', name: 'Hierba nueva', scientificName: '', properties: '', uses: [], aliases: [], warnings: '', notes: '', published: true });
  catalog.preparations[0].ingredients.push({ plantId: 'plant-nueva', amount: '1 parte' });
  validateCatalog(catalog);
  assert.ok(searchCatalog(catalog, 'hinchazon').preparations[0].ingredients.some(i => i.plantId === 'plant-nueva'));
});
test('impide referencias rotas y plantas repetidas', () => {
  const missing = activeCatalog(); missing.plants.shift();
  assert.throws(() => validateCatalog(missing), /inválidas/);
  const duplicate = activeCatalog(); duplicate.preparations[0].ingredients.push(duplicate.preparations[0].ingredients[0]);
  assert.throws(() => validateCatalog(duplicate), /repetidas/);
});
test('buscar por el nombre de una hierba encuentra los tónicos que la llevan', () => {
  const names = searchCatalog(seedCatalog, 'manzanilla').preparations.map(p => p.name);
  assert.deepEqual(names, ['Tónico digestivo']);
  assert.ok(searchCatalog(seedCatalog, 'jengibre').preparations.length >= 2);
});
test('los tónicos iniciales indican en qué situaciones no se recomiendan', () => {
  assert.ok(seedCatalog.preparations.every(p => p.avoid?.length));
  const invalid = structuredClone(seedCatalog); invalid.preparations[0].avoid = ['otra cosa', 'otra cosa'];
  assert.throws(() => validateCatalog(invalid), /no recomendado/);
});
test('exportar e importar el catálogo conserva los tónicos', () => {
  const report = importTonics(structuredClone(seedCatalog), exportTonics(seedCatalog));
  assert.equal(report.created, 0);
  assert.equal(report.updated, seedCatalog.preparations.length);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.catalog.preparations.map(p => [p.name, p.published, p.avoid]), seedCatalog.preparations.map(p => [p.name, p.published, p.avoid]));
});
test('importar crea tónicos y hierbas nuevas, y deja en borrador los incompletos', () => {
  const csv = 'Nombre;Usos;Hierbas;Preparación;Habilitado\r\nTónico nuevo;gases|pesadez;Manzanilla:1 parte|Salvia:2 partes;Infusión de 5 minutos;Sí\r\nTónico a medias;tos;Tomillo:1 parte;;Sí\r\n;;;;\r\nSin hierbas;tos;;x;No\r\n';
  const report = importTonics(structuredClone(seedCatalog), csv);
  assert.equal(report.created, 2);
  assert.deepEqual(report.drafts, ['Tónico a medias']);
  assert.equal(report.errors.length, 1);
  const created = report.catalog.preparations.find(p => p.name === 'Tónico nuevo');
  assert.equal(created.published, true);
  assert.ok(report.catalog.plants.some(p => p.name === 'Salvia'));
  validateCatalog(report.catalog);
});

test('un tónico habilitado solo necesita nombre y una hierba', () => {
  const catalog = activeCatalog();
  Object.assign(catalog.preparations[0], { instructions: '', uses: [], ingredients: [{ plantId: 'plant-1', amount: '' }] });
  validateCatalog(catalog);
});
test('el precio es opcional, se valida y se formatea en pesos', () => {
  const catalog = activeCatalog();
  validateCatalog(catalog);
  assert.equal(formatPrice(catalog.preparations[0]), '');
  catalog.preparations[0].price = 2500; catalog.preparations[0].priceUnit = '100 g';
  catalog.plants[0].price = 0;
  validateCatalog(catalog);
  assert.match(formatPrice(catalog.preparations[0]), /2\.500 \/ 100 g$/);
  for (const bad of [-1, Number.NaN, '10']) { catalog.plants[0].price = bad; assert.throws(() => validateCatalog(catalog), /precio/i); }
  catalog.plants[0].price = 1; catalog.plants[0].priceUnit = 'x'.repeat(51);
  assert.throws(() => validateCatalog(catalog), /unidad/i);
});
test('el CSV conserva el precio y un CSV sin esa columna no lo borra', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.preparations[0].price = 1800.5; catalog.preparations[0].priceUnit = 'bolsita';
  const back = importTonics(structuredClone(catalog), exportTonics(catalog));
  assert.deepEqual(back.errors, []);
  assert.equal(back.catalog.preparations[0].price, 1800.5);
  assert.equal(back.catalog.preparations[0].priceUnit, 'bolsita');
  const old = 'Nombre;Hierbas\r\nTónico digestivo;Manzanilla:2 partes\r\n';
  assert.equal(importTonics(catalog, old).catalog.preparations[0].price, 1800.5);
  assert.equal(importTonics(catalog, 'Nombre;Hierbas;Precio\r\nTónico digestivo;Manzanilla:2 partes;abc\r\n').errors.length, 1);
});
test('el mensaje para compartir incluye el precio solo si existe', () => {
  const catalog = structuredClone(seedCatalog); const prep = catalog.preparations[0];
  const options = { selected: prep.ingredients.map(i => i.plantId) };
  assert.ok(!recipeText(prep, catalog, options).includes('Precio'));
  prep.price = 3000;
  assert.match(recipeText(prep, catalog, options), /Precio: .*3\.000/);
});
test('los slugs salen del nombre y no se repiten', () => {
  assert.equal(slugify('Té de Menta, Ñandú!'), 'te-de-menta-nandu');
  assert.equal(slugify('???'), 'producto');
  const slugs = assignSlugs([
    { id: 'a', name: 'Menta', tonic: false }, { id: 'b', name: 'menta', tonic: true },
    { id: 'c', name: 'Boldo', tonic: false }, { id: 'plant-9', name: 'Tilo', tonic: false }, { id: 'plant-8', name: 'Tilo', tonic: false },
  ]);
  assert.equal(slugs.get('a'), 'menta-hierba');
  assert.equal(slugs.get('b'), 'menta-tonico');
  assert.equal(slugs.get('c'), 'boldo');
  assert.notEqual(slugs.get('plant-9'), slugs.get('plant-8'));
  assert.equal(new Set(slugs.values()).size, 5);
});

// Online store (docs/tienda-online.md, fase 1)
const combo = (over = {}) => ({ id: 'combo-1', name: 'Combo digestivo', description: '', items: [{ productId: 'plant-1', qty: 2 }, { productId: 'prep-1', qty: 1 }], price: 5000, active: true, ...over });
test('un catálogo guardado antes de la tienda sigue siendo válido y todo está en la tienda', () => {
  const catalog = structuredClone(seedCatalog);
  validateCatalog(catalog);
  assert.ok([...catalog.plants, ...catalog.preparations].every(item => isInStore(catalog, item)));
});
test('la fecha de la tienda usa la hora de Argentina', () => {
  assert.equal(storeToday(new Date('2026-10-27T02:30:00Z')), '2026-10-26');
  assert.equal(storeToday(new Date('2026-10-27T03:30:00Z')), '2026-10-27');
});
test('el precio vigente aplica la oferta solo cuando corresponde', () => {
  const today = '2026-10-26';
  assert.deepEqual(effectivePrice({}, today), { onPromo: false, unit: '' });
  assert.deepEqual(effectivePrice({ promoPrice: 10 }, today), { onPromo: false, unit: '' }, 'sin precio no hay oferta');
  assert.deepEqual(effectivePrice({ price: 100, priceUnit: ' 100 g ' }, today), { price: 100, regular: 100, onPromo: false, unit: '100 g' });
  assert.deepEqual(effectivePrice({ price: 100, promoPrice: 80 }, today), { price: 80, regular: 100, onPromo: true, unit: '' });
  assert.equal(effectivePrice({ price: 100, promoPrice: 80, promoUntil: '2026-10-26' }, today).onPromo, true, 'el último día incluido');
  assert.equal(effectivePrice({ price: 100, promoPrice: 80, promoUntil: '2026-10-25' }, today).price, 100, 'oferta vencida');
  assert.equal(effectivePrice({ price: 100, promoPrice: 100 }, today).onPromo, false, 'oferta igual al precio');
  assert.equal(effectivePrice({ price: 100, promoPrice: 120 }, today).price, 100, 'oferta mayor al precio');
  assert.equal(effectivePrice({ price: 100, promoPrice: 0 }, today).price, 0, 'una oferta gratis es válida');
});
test('ocultar un producto o todas sus categorías lo saca de la tienda, no del catálogo', () => {
  const catalog = structuredClone(seedCatalog);
  const menta = catalog.plants.find(p => p.name === 'Menta');
  assert.equal(storeCategory(catalog, menta).id, 'mate');
  catalog.categories = [{ id: 'mate', label: 'Mate', hidden: true }, { id: 'herbs', label: 'Hierbas' }, { id: 'tonics', label: 'Tónicos' }];
  assert.equal(storeCategory(catalog, menta).id, 'herbs', 'pasa a la siguiente categoría visible');
  catalog.categories[1].hidden = true;
  assert.equal(isInStore(catalog, menta), false);
  validateCatalog(catalog);
  assert.ok(searchCatalog(catalog, 'menta').plants.some(p => p.id === menta.id), 'el vendedor la sigue encontrando');
  const tonic = catalog.preparations[0];
  tonic.hidden = true;
  assert.equal(isInStore(catalog, tonic), false);
  tonic.hidden = false; tonic.published = false;
  assert.equal(isInStore(catalog, tonic), false, 'un borrador nunca está en la tienda');
});
test('valida ocultos, ofertas y fechas', () => {
  const catalog = structuredClone(seedCatalog);
  Object.assign(catalog.plants[0], { hidden: true, price: 100, promoPrice: 150, promoUntil: '2028-02-29' });
  validateCatalog(catalog);
  for (const [field, value, message] of [['hidden', 'si', /inválida/], ['promoPrice', -1, /oferta/], ['promoPrice', '80', /oferta/], ['promoUntil', '2026-02-30', /fecha/], ['promoUntil', '2026-13-01', /fecha/], ['promoUntil', '26/10/2026', /fecha/]]) {
    const bad = structuredClone(catalog); bad.plants[0][field] = value;
    assert.throws(() => validateCatalog(bad), message, `${field}=${value}`);
  }
  const hiddenCategory = structuredClone(catalog); hiddenCategory.categories = [{ id: 'herbs', label: 'Hierbas', hidden: 'no' }, { id: 'mate', label: 'Mate' }, { id: 'tonics', label: 'Tónicos' }];
  assert.throws(() => validateCatalog(hiddenCategory), /Categorías/);
});
test('valida los datos de la tienda', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.store = { whatsapp: '5493491123456', instagram: '@nekurel', facebook: 'https://facebook.com/nekurel', address: 'Julio A. Roca 625', mapsUrl: 'https://maps.app.goo.gl/abc', hours: 'Lunes a viernes 8 a 12' };
  validateCatalog(catalog);
  validateCatalog({ ...catalog, store: { whatsapp: '', mapsUrl: '' } });
  for (const store of [{ whatsapp: '+54 9 3491' }, { whatsapp: '03491123456' }, { instagram: 'http://instagram.com/x' }, { mapsUrl: 'maps.google.com' }, { mapsUrl: 'javascript:alert(1)' }, { hours: 'x'.repeat(1001) }, []]) {
    assert.throws(() => validateCatalog({ ...catalog, store }), /tienda|WhatsApp|https|horarios/i, JSON.stringify(store).slice(0, 40));
  }
});
test('valida los combos', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.combos = [combo()];
  validateCatalog(catalog);
  const cases = [
    [{ items: [] }, /entre 1 y 20/], [{ items: [{ productId: 'nada', qty: 1 }] }, /ya no existe/],
    [{ items: [{ productId: 'plant-1', qty: 1 }, { productId: 'plant-1', qty: 1 }] }, /repite/],
    [{ items: [{ productId: 'plant-1', qty: 1.5 }] }, /enteros/], [{ items: [{ productId: 'plant-1', qty: 100 }] }, /enteros/],
    [{ price: -1 }, /precio del combo/], [{ price: undefined }, /precio del combo/], [{ active: 'si' }, /inválido/],
    [{ name: '' }, /obligatorios/], [{ image: 'https://otro.sitio/x.png' }, /Imagen/],
  ];
  for (const [over, message] of cases) assert.throws(() => validateCatalog({ ...catalog, combos: [combo(over)] }), message, JSON.stringify(over));
  assert.throws(() => validateCatalog({ ...catalog, combos: [combo(), combo({ id: 'combo-2', name: 'COMBO Digestivo' })] }), /dos combos/);
  assert.throws(() => validateCatalog({ ...catalog, combos: [combo(), combo({ name: 'Otro' })] }), /duplicado/);
});
test('un combo con un producto oculto queda fuera de la tienda y se avisa', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.combos = [combo(), combo({ id: 'combo-2', name: 'Inactivo', active: false })];
  assert.equal(isComboInStore(catalog, catalog.combos[0]), true);
  assert.equal(isComboInStore(catalog, catalog.combos[1]), false, 'un combo inactivo no se muestra');
  assert.deepEqual(brokenCombos(catalog), []);
  catalog.plants[0].hidden = true;
  assert.equal(isComboInStore(catalog, catalog.combos[0]), false);
  assert.deepEqual(brokenCombos(catalog).map(c => c.id), ['combo-1'], 'el inactivo no cuenta como roto');
  assert.deepEqual(combosUsing(catalog, 'prep-1').map(c => c.id), ['combo-1', 'combo-2']);
  assert.deepEqual(combosUsing(catalog, 'plant-5'), []);
  const deleted = structuredClone(catalog); deleted.plants = deleted.plants.filter(p => p.id !== 'plant-1');
  deleted.preparations = deleted.preparations.filter(p => !p.ingredients.some(i => i.plantId === 'plant-1'));
  assert.throws(() => validateCatalog(deleted), /ya no existe/, 'no se puede borrar un producto usado en un combo');
});
test('el ahorro de un combo usa el precio regular, nunca la oferta', () => {
  const catalog = structuredClone(seedCatalog);
  const c = combo();
  assert.equal(comboSavings(catalog, c), undefined, 'sin precios no hay ahorro');
  Object.assign(catalog.plants[0], { price: 1500, promoPrice: 500 });
  catalog.preparations[0].price = 3000;
  assert.deepEqual(comboSavings(catalog, c), { regular: 6000, savings: 1000 });
  assert.deepEqual(comboSavings(catalog, combo({ price: 7000 })), { regular: 6000, savings: 0 }, 'un combo más caro no muestra ahorro negativo');
});
test('reimportar el CSV conserva ocultos y ofertas', () => {
  const catalog = structuredClone(seedCatalog);
  Object.assign(catalog.preparations[0], { hidden: true, price: 3000, promoPrice: 2500, promoUntil: '2026-12-31' });
  const back = importTonics(structuredClone(catalog), exportTonics(catalog)).catalog.preparations[0];
  assert.equal(back.hidden, true);
  assert.equal(back.promoPrice, 2500);
  assert.equal(back.promoUntil, '2026-12-31');
});
