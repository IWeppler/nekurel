import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, searchCatalog, validateCatalog, getAvoidOptions, getCategories, itemCategories } from '../lib/catalog.ts';
import { recipeText, whatsappUrl, partsOf, herbText } from '../lib/recipe.ts';
import { imageFormat, validImageName } from '../lib/images.ts';
import { exportTonics, importTonics } from '../lib/csv.ts';

test('mate encuentra hierbas sin requerir un tónico asociado', () => {
  const result = searchCatalog(seedCatalog, 'hierbas para mate');
  assert.equal(result.preparations.length, 0);
  assert.deepEqual(result.plants.map(p => p.name).sort(), ['Burrito', 'Cedrón', 'Menta']);
  const solo = { ...structuredClone(seedCatalog), preparations: [] };
  assert.equal(searchCatalog(solo, 'MATE').plants.length, 3);
});
test('hierbas se encuentran por nombre científico, propiedades y etiquetas nuevas', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.plants[0].aliases.push('sobremesa suave');
  assert.equal(searchCatalog(catalog, 'Matricaria chamomilla').plants[0].name, 'Manzanilla');
  assert.equal(searchCatalog(catalog, 'sobremesa suave').plants[0].name, 'Manzanilla');
  assert.ok(searchCatalog(catalog, 'aromática').plants.some(p => p.name === 'Menta'));
});
test('imágenes son opcionales para catálogos existentes y solo aceptan referencias locales', () => {
  validateCatalog(seedCatalog);
  const catalog = structuredClone(seedCatalog);
  catalog.plants[0].image = '/api/images/12345678-1234-1234-1234-123456789abc.png';
  validateCatalog(catalog);
  catalog.plants[0].image = 'javascript:alert(1)';
  assert.throws(() => validateCatalog(catalog), /Imagen inválida/);
});
test('detecta archivos de imagen y rechaza SVG y nombres con recorrido de rutas', () => {
  assert.equal(imageFormat(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])), 'png');
  assert.equal(imageFormat(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(validImageName('../../catalog.json'), false);
  assert.equal(validImageName('12345678-1234-1234-1234-123456789abc.webp'), true);
});
test('receta completa conserva ingredientes y advertencias y no divulga notas internas', () => {
  const prep = { ...seedCatalog.preparations[0], notes: 'Dato privado que no debe compartirse' };
  const text = recipeText(prep, seedCatalog, { selected: prep.ingredients.map(i => i.plantId), total: 100 });
  assert.match(text, /Manzanilla: 2 partes \(50 g\)/);
  assert.match(text, /Menta: 1 parte \(25 g\)/);
  assert.match(text, /Advertencias:/);
  assert.match(text, /No recomendado en: Embarazo/);
  assert.ok(!text.includes(prep.notes));
});
test('selección parcial recalcula cantidades y usa preparación confirmada, sin inventar usos', () => {
  const prep = seedCatalog.preparations[0];
  assert.throws(() => recipeText(prep, seedCatalog, { selected: ['plant-1'] }), /Completá la preparación/);
  const text = recipeText(prep, seedCatalog, { selected: ['plant-1','plant-2'], total: 90, instructions: 'Indicación confirmada para esta selección.' });
  assert.match(text, /Manzanilla: 2 partes \(60 g\)/);
  assert.match(text, /Menta: 1 parte \(30 g\)/);
  assert.ok(!text.includes('Hinojo'));
  assert.ok(!text.includes('Usos tradicionales:'));
  assert.ok(!text.includes(prep.instructions));
  assert.match(text, /Indicación confirmada/);
  assert.throws(() => recipeText(prep, seedCatalog, { selected: [] }), /al menos una/);
});
test('cantidades invalidas no se convierten ni se comparten', () => {
  assert.equal(partsOf('0 partes'), null);
  assert.equal(partsOf('2 partes por día'), null);
  assert.equal(partsOf('1,5 partes'), 1.5);
  const prep = seedCatalog.preparations[0];
  for (const total of [0, NaN, Infinity, -1, 100001]) assert.throws(() => recipeText(prep, seedCatalog, { selected: prep.ingredients.map(i => i.plantId), total }), /cantidad total/);
});
test('enlace de WhatsApp valida formato internacional y codifica el texto exactamente', () => {
  const text = 'Ñekurel\nManzanilla + Menta: 50 g & advertencias';
  const url = new URL(whatsappUrl('+54 9 (11) 1234-5678', text));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5491112345678');
  assert.equal(url.searchParams.get('text'), text);
  assert.equal(new URL(whatsappUrl('3491 123456', text)).pathname, '/5493491123456');
  assert.equal(new URL(whatsappUrl('3491 1234 5678', text)).pathname, '/549349112345678');
  assert.equal(new URL(whatsappUrl('+54 9 3491 123456', text)).pathname, '/5493491123456');
  for (const number of ['01112345678', '123', '+54abc123456789', '+54/123456789']) assert.throws(() => whatsappUrl(number, text));
  assert.ok(!herbText({ ...seedCatalog.plants[0], notes: 'NOTA PRIVADA' }).includes('NOTA PRIVADA'));
});
test('CSV conserva fotos y un CSV antiguo no borra la imagen existente', () => {
  const catalog = structuredClone(seedCatalog);
  const image = '/api/images/12345678-1234-1234-1234-123456789abc.png';
  catalog.preparations[0].image = image;
  assert.equal(importTonics(catalog, exportTonics(catalog)).catalog.preparations[0].image, image);
  const csv = 'Nombre;Usos;Hierbas;Preparación;Habilitado\nTónico digestivo;gases;Manzanilla:1 parte;Preparación existente;Sí';
  assert.equal(importTonics(catalog, csv).catalog.preparations[0].image, image);
});

test('situaciones nuevas se validan, aparecen en filtros y se comparten', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.preparations[0].avoid.push('Hipertensión');
  validateCatalog(catalog);
  assert.ok(getAvoidOptions(catalog).some(option => option.id === 'Hipertensión' && option.label === 'Hipertensión'));
  assert.match(recipeText(catalog.preparations[0], catalog, { selected: catalog.preparations[0].ingredients.map(i => i.plantId), total: 100 }), /Hipertensión/);
  const imported = importTonics(catalog, exportTonics(catalog));
  assert.ok(imported.catalog.preparations.find(p => p.id === catalog.preparations[0].id).avoid.includes('Hipertensión'));
  catalog.preparations[0].avoid.push('Hipertensión');
  assert.throws(() => validateCatalog(catalog), /no recomendado/);
});



test('imágenes de categorías son independientes y compatibles con catálogos anteriores', () => {
  const catalog = structuredClone(seedCatalog);
  validateCatalog(catalog);
  catalog.categoryImages = { mate: '/api/images/12345678-1234-1234-1234-123456789abc.png', herbs: '', tonics: '' };
  validateCatalog(catalog);
  assert.equal(importTonics(catalog, exportTonics(catalog)).catalog.categoryImages.mate, catalog.categoryImages.mate);
  catalog.categoryImages.mate = 'https://example.com/image.png';
  assert.throws(() => validateCatalog(catalog), /Imagen de categoría/);
  catalog.categoryImages = { ventas: '' };
  assert.throws(() => validateCatalog(catalog), /Imagen de categoría/);
});

test('categorías editables mantienen relaciones múltiples y compatibilidad', () => {
  const catalog = structuredClone(seedCatalog);
  assert.deepEqual(itemCategories(catalog.preparations[0]), ['tonics']);
  assert.ok(itemCategories(catalog.plants.find(p => p.name === 'Menta')).includes('mate'));
  catalog.categories = [...getCategories(catalog), { id: 'infusion', label: 'Para infusión' }];
  catalog.categories.find(c => c.id === 'mate').label = 'Para el mate';
  catalog.plants[0].categoryIds = ['mate', 'infusion'];
  catalog.preparations[0].categoryIds = ['tonics', 'infusion'];
  validateCatalog(catalog);
  assert.deepEqual(itemCategories(catalog.plants[0]), ['mate', 'infusion']);
  assert.equal(getCategories(catalog).find(c => c.id === 'mate').label, 'Para el mate');
  assert.deepEqual(importTonics(catalog, exportTonics(catalog)).catalog.preparations[0].categoryIds, ['tonics', 'infusion']);
  catalog.plants[0].categoryIds = [];
  assert.deepEqual(itemCategories(catalog.plants[0]), []);
  catalog.plants[0].categoryIds = ['desconocida'];
  assert.throws(() => validateCatalog(catalog), /Categorías de la ficha/);
  catalog.plants[0].categoryIds = ['mate', 'mate'];
  assert.throws(() => validateCatalog(catalog), /Categorías de la ficha/);
  catalog.plants[0].categoryIds = ['mate'];
  catalog.categories.push({ id: 'repetida', label: 'Para infusión' });
  assert.throws(() => validateCatalog(catalog), /nombre distinto/);
});
