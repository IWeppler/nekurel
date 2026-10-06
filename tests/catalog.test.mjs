import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, searchCatalog, validateCatalog, relevance } from '../lib/catalog.ts';
import { exportTonics, importTonics } from '../lib/csv.ts';

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
test('impide referencias rotas, plantas repetidas y preparación incompleta', () => {
  const missing = activeCatalog(); missing.plants.shift();
  assert.throws(() => validateCatalog(missing), /inválidas/);
  const duplicate = activeCatalog(); duplicate.preparations[0].ingredients.push(duplicate.preparations[0].ingredients[0]);
  assert.throws(() => validateCatalog(duplicate), /repetidas/);
  const incomplete = activeCatalog(); incomplete.preparations[0].instructions = '';
  assert.throws(() => validateCatalog(incomplete), /completá/i);
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

