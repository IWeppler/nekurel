import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, searchCatalog, validateCatalog, relevance } from '../lib/catalog.ts';
import { exportTonics, importTonics } from '../lib/csv.ts';
import { formatPrice, slugify, assignSlugs } from '../lib/catalog.ts';
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
