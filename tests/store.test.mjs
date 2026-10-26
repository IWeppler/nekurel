import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, assignSlugs, comboSlug, formatMoney } from '../lib/catalog.ts';
import { buildShop } from '../lib/shop.ts';
import { socialLink, whatsappDigits, parsePriceText, bulkPrice, bulkError, priceRows, resolveEdit, summarizeEdits, applyPriceEdits } from '../lib/store-tools.ts';
import { parseCart, serializeCart, addToCart, setQty, removeFromCart, canAdd, cartCount, resolveCart, validateOrder, orderMessage, orderUrl, MAX_LINES, ORDER_URL_LIMIT } from '../lib/cart.ts';

// Online store (docs/tienda-online.md, fases 5 y 6)
const today = '2026-10-26';
const combo = (over = {}) => ({ id: 'combo-1', name: 'Combo Digestivo', description: 'Para después de comer', items: [{ productId: 'plant-1', qty: 2 }, { productId: 'prep-1', qty: 1 }], price: 5000, active: true, ...over });
function pricedCatalog() {
  const catalog = structuredClone(seedCatalog);
  Object.assign(catalog.plants[0], { price: 1500, priceUnit: '100 g' });
  Object.assign(catalog.preparations[0], { price: 3000, priceUnit: 'bolsita', promoPrice: 2500, promoUntil: '2026-10-31' });
  catalog.combos = [combo()];
  return catalog;
}
const order = (over = {}) => ({ name: 'Ana', delivery: 'pickup', address: '', note: '', ...over });

test('la tienda muestra el precio de oferta y el regular tachado', () => {
  const shop = buildShop(pricedCatalog(), today);
  const tonic = shop.items.find(i => i.id === 'prep-1');
  assert.equal(tonic.price, `${formatMoney(2500)} / bolsita`);
  assert.equal(tonic.regularPrice, `${formatMoney(3000)} / bolsita`);
  assert.equal(tonic.pricing.onPromo, true);
  const herb = shop.items.find(i => i.id === 'plant-1');
  assert.equal(herb.regularPrice, undefined);
  assert.equal(shop.items.find(i => i.id === 'plant-2').price, '', 'sin precio queda en Consultar');
  assert.equal(buildShop(pricedCatalog(), '2026-11-01').items.find(i => i.id === 'prep-1').price, `${formatMoney(3000)} / bolsita`, 'la oferta vence sola');
});
test('los combos muestran el ahorro contra el precio regular y desaparecen si un producto se oculta', () => {
  const catalog = pricedCatalog();
  let shop = buildShop(catalog, today);
  assert.equal(shop.combos.length, 1);
  const [c] = shop.combos;
  assert.equal(c.key, 'c:combo-1');
  assert.equal(c.slug, 'combo-digestivo');
  assert.equal(c.regularPrice, formatMoney(6000), '2 x 1500 + 3000 regular, aunque el tónico esté en oferta');
  assert.equal(c.savings, formatMoney(1000));
  assert.deepEqual(c.items.map(i => [i.name, i.qty]), [['Manzanilla', 2], ['Tónico digestivo', 1]]);
  assert.ok(c.items.every(i => i.slug), 'cada producto del combo enlaza a su ficha');
  catalog.plants[0].hidden = true;
  shop = buildShop(catalog, today);
  assert.equal(shop.combos.length, 0);
  assert.ok(!shop.offers.some(o => o.key === 'c:combo-1'), 'tampoco se puede comprar');
  assert.ok(!shop.items.some(i => i.id === 'plant-1'));
});
test('un combo sin ahorro no lo anuncia', () => {
  const catalog = pricedCatalog(); catalog.combos = [combo({ price: 9000 })];
  assert.equal(buildShop(catalog, today).combos[0].savings, undefined);
  catalog.plants[0].price = undefined;
  assert.equal(buildShop(catalog, today).combos[0].savings, undefined, 'si falta un precio no se puede calcular');
});
test('las ofertas que llegan al navegador no incluyen datos internos', () => {
  const catalog = pricedCatalog();
  catalog.preparations[0].notes = 'SECRETO';
  const shop = buildShop(catalog, today);
  assert.ok(!JSON.stringify(shop.offers).includes('SECRETO'));
  assert.ok(!JSON.stringify(shop.offers).includes(catalog.preparations[0].instructions));
  assert.deepEqual(Object.keys(shop.offers[0]).sort(), ['key', 'name', 'price', 'unit']);
  assert.deepEqual(shop.offers.find(o => o.key === 'p:prep-1'), { key: 'p:prep-1', name: 'Tónico digestivo', unit: 'bolsita', price: 2500 });
});
test('un producto no puede tomar el slug reservado de los combos', () => {
  const slugs = assignSlugs([{ id: 'a', name: 'Combos', tonic: false }, { id: 'b', name: 'Manzanilla', tonic: false }]);
  assert.equal(slugs.get('a'), 'combos-producto');
  assert.equal(comboSlug({ name: 'Combo Té & Mate' }), 'combo-te-mate');
});

test('el carrito suma, limita y quita cantidades', () => {
  let cart = addToCart([], 'p:plant-1');
  cart = addToCart(cart, 'p:plant-1', 2);
  assert.deepEqual(cart, [{ key: 'p:plant-1', qty: 3 }]);
  cart = addToCart(cart, 'c:combo-1');
  assert.equal(cartCount(cart), 4);
  assert.equal(setQty(cart, 'p:plant-1', 500)[0].qty, 99);
  assert.equal(setQty(cart, 'p:plant-1', 2.7)[0].qty, 2);
  assert.deepEqual(setQty(cart, 'p:plant-1', 0).map(l => l.key), ['c:combo-1']);
  assert.deepEqual(setQty(cart, 'p:plant-1', Number.NaN).map(l => l.key), ['c:combo-1']);
  assert.deepEqual(removeFromCart(cart, 'c:combo-1'), [{ key: 'p:plant-1', qty: 3 }]);
  assert.deepEqual(addToCart(cart, 'basura'), cart, 'claves inválidas se ignoran');
  assert.deepEqual(addToCart([], 'p:x', 0), []);
});
test('el carrito tiene un máximo de líneas', () => {
  let cart = [];
  for (let i = 0; i < MAX_LINES; i++) cart = addToCart(cart, `p:${i}`);
  assert.equal(canAdd(cart, 'p:nuevo'), false);
  assert.equal(addToCart(cart, 'p:nuevo').length, MAX_LINES);
  assert.equal(canAdd(cart, 'p:0'), true, 'sumar a una línea existente sigue permitido');
});
test('lo guardado en el navegador se lee con desconfianza', () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart('no es json'), []);
  assert.deepEqual(parseCart('{"key":"p:1","qty":1}'), []);
  const raw = JSON.stringify([{ key: 'p:1', qty: 2 }, { key: 'p:1', qty: 5 }, { key: 'x:1', qty: 1 }, { key: 'p:2', qty: -3 }, { key: 'p:3', qty: '2' }, { key: 'p:4', qty: 1000 }, null, { key: 'c:9', qty: 1, price: 1 }]);
  assert.deepEqual(parseCart(raw), [{ key: 'p:1', qty: 2 }, { key: 'p:4', qty: 99 }, { key: 'c:9', qty: 1 }], 'el precio guardado no se conserva');
  const cart = [{ key: 'p:1', qty: 2 }];
  assert.deepEqual(parseCart(serializeCart(cart)), cart);
  assert.equal(parseCart(JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ key: `p:${i}`, qty: 1 })))).length, MAX_LINES);
});
test('el carrito se cotiza siempre con los precios actuales', () => {
  const shop = buildShop(pricedCatalog(), today);
  const cart = [{ key: 'p:plant-1', qty: 2 }, { key: 'c:combo-1', qty: 1 }, { key: 'p:prep-1', qty: 1 }, { key: 'p:plant-2', qty: 1 }, { key: 'p:borrado', qty: 4 }];
  const resolved = resolveCart(cart, shop.offers);
  assert.deepEqual(resolved.lines.map(l => [l.name, l.qty, l.subtotal]), [['Manzanilla', 2, 3000], ['Combo Digestivo', 1, 5000], ['Tónico digestivo', 1, 2500], ['Menta', 1, undefined]]);
  assert.equal(resolved.total, 10500);
  assert.equal(resolved.pending, 1);
  assert.deepEqual(resolved.removed, ['p:borrado']);
  assert.equal(resolved.cart.length, 4);
  assert.equal(resolveCart([{ key: 'p:a', qty: 3 }], [{ key: 'p:a', name: 'A', unit: '', price: 0.1 }]).total, 0.3, 'sin errores de redondeo');
});
test('el pedido valida nombre y dirección', () => {
  assert.deepEqual(validateOrder(order()), {});
  assert.ok(validateOrder(order({ name: '  ' })).name);
  assert.ok(validateOrder(order({ delivery: 'delivery' })).address);
  assert.deepEqual(validateOrder(order({ delivery: 'delivery', address: 'Calle 123' })), {});
  assert.ok(validateOrder(order({ note: 'x'.repeat(501) })).note);
  assert.ok(validateOrder(order({ delivery: 'avion' })).delivery);
});
test('el mensaje del pedido sigue el formato acordado', () => {
  const shop = buildShop(pricedCatalog(), today);
  const resolved = resolveCart([{ key: 'p:plant-1', qty: 2 }, { key: 'c:combo-1', qty: 1 }, { key: 'p:plant-2', qty: 1 }], shop.offers);
  assert.equal(orderMessage(resolved, order({ delivery: 'delivery', address: 'Calle 123', note: 'sin bolsa, por favor.' })), [
    'Hola, quiero hacer un pedido en Ñekurel.', '',
    'Nombre: Ana', 'Entrega: Envío a Calle 123', '',
    `2 x Manzanilla (100 g): ${formatMoney(3000)}`, `1 x Combo Digestivo: ${formatMoney(5000)}`, '1 x Menta: precio a confirmar', '',
    `Total: ${formatMoney(8000)} (más los productos a confirmar)`, 'Nota: sin bolsa, por favor.',
  ].join('\n'));
  const pickup = orderMessage(resolveCart([{ key: 'p:plant-1', qty: 1 }], shop.offers), order());
  assert.match(pickup, /Entrega: Retiro en el local/);
  assert.match(pickup, new RegExp(`Total: ${formatMoney(1500).replace('$', '\\$')}$`));
  assert.match(orderMessage(resolveCart([{ key: 'p:plant-2', qty: 1 }], shop.offers), order()), /Total: a confirmar$/);
  assert.throws(() => orderMessage(resolveCart([], shop.offers), order()), /vacío/);
});
test('lo que escribe el cliente no puede agregar líneas falsas al pedido', () => {
  const shop = buildShop(pricedCatalog(), today);
  const message = orderMessage(resolveCart([{ key: 'p:plant-1', qty: 1 }], shop.offers), order({ name: 'Ana\n\nTotal: $ 0', note: 'hola\r\nTotal: $ 0\u2028x\u0007' }));
  assert.equal(message.split('\n').filter(l => l.startsWith('Total:')).length, 1);
  assert.match(message, /Nombre: Ana Total: \$ 0\n/);
  assert.match(message, /Nota: hola Total: \$ 0 x$/);
});
test('el link de WhatsApp exige el número de la tienda y avisa si es muy largo', () => {
  assert.throws(() => orderUrl('', 'hola'), /número/);
  assert.throws(() => orderUrl('03491', 'hola'), /número/);
  const { url, tooLong } = orderUrl('5493491123456', 'Hola & chau');
  assert.equal(url, 'https://wa.me/5493491123456?text=Hola%20%26%20chau');
  assert.equal(tooLong, false);
  assert.equal(orderUrl('5493491123456', 'ñ'.repeat(ORDER_URL_LIMIT)).tooLong, true);
});

// Tienda tab (fases 2 y 3)
test('los usuarios de redes se convierten en links seguros', () => {
  assert.deepEqual(socialLink('@nekurel', 'instagram'), { href: 'https://instagram.com/nekurel', label: '@nekurel' });
  assert.deepEqual(socialLink('nekurel', 'facebook'), { href: 'https://facebook.com/nekurel', label: 'nekurel' });
  assert.equal(socialLink('instagram.com/nekurel/', 'instagram').href, 'https://instagram.com/nekurel');
  assert.equal(socialLink('https://www.facebook.com/nekurel', 'facebook').href, 'https://www.facebook.com/nekurel');
  assert.equal(socialLink('', 'instagram'), undefined);
  assert.equal(socialLink('javascript:alert(1)', 'instagram'), undefined, 'nunca un link ejecutable');
  assert.equal(socialLink('mi tienda de hierbas', 'instagram'), undefined);
});
test('el WhatsApp queda en solo dígitos', () => {
  assert.equal(whatsappDigits('+54 9 3491-123456'), '5493491123456');
  assert.equal(whatsappDigits('(0349) 15-123'), '034915123');
});
test('los precios escritos se validan con un mensaje claro', () => {
  assert.deepEqual(parsePriceText(''), {});
  assert.deepEqual(parsePriceText(' 1500,5 '), { value: 1500.5 });
  assert.match(parsePriceText('-3').error, /0 o más/);
  assert.match(parsePriceText('abc').error, /0 o más/);
  assert.ok(parsePriceText('1e12').error);
});
test('las acciones masivas suben, bajan, redondean y fijan', () => {
  assert.equal(bulkPrice(1000, { kind: 'percent', percent: 10 }), 1100);
  assert.equal(bulkPrice(1000, { kind: 'percent', percent: -15 }), 850);
  assert.equal(bulkPrice(333, { kind: 'percent', percent: 10 }), 366.3);
  assert.equal(bulkPrice(1020, { kind: 'round', step: 50 }), 1000);
  assert.equal(bulkPrice(1030, { kind: 'round', step: 50 }), 1050);
  assert.equal(bulkPrice(undefined, { kind: 'percent', percent: 10 }), undefined, 'sin precio no hay nada que ajustar');
  assert.equal(bulkPrice(undefined, { kind: 'fixed', price: 2500 }), 2500);
  assert.ok(bulkError({ kind: 'percent', percent: -100 }));
  assert.ok(bulkError({ kind: 'percent', percent: 0 }));
  assert.ok(bulkError({ kind: 'round', step: 0 }));
  assert.ok(bulkError({ kind: 'fixed', price: -1 }));
  assert.equal(bulkError({ kind: 'percent', percent: 10 }), undefined);
});
test('subir 10% a 30 productos es un solo catálogo listo para guardar', () => {
  const catalog = structuredClone(seedCatalog);
  catalog.plants.forEach((p, n) => { p.price = 1000 + n * 100; });
  const rows = priceRows(catalog);
  const edits = {};
  for (const row of rows.slice(0, 30)) { const price = bulkPrice(resolveEdit(row, undefined).price, { kind: 'percent', percent: 10 }); if (price !== undefined) edits[row.id] = { price: String(price) }; }
  const summary = summarizeEdits(rows, edits, catalog);
  assert.equal(summary.changed, rows.slice(0, 30).filter(r => r.price !== undefined).length);
  assert.ok(summary.changed > 10, 'el caso cubre muchos productos');
  assert.equal(summary.errors, 0);
  const next = applyPriceEdits(catalog, edits);
  assert.equal(next.plants[0].price, 1100);
  assert.equal(next.revision, catalog.revision, 'la revisión no se toca: la sube el servidor al guardar');
  assert.equal(next.preparations[0], catalog.preparations[0], 'lo que no cambió queda igual');
  assert.equal(catalog.plants[0].price, 1000, 'no modifica el catálogo original');
});
test('los precios inválidos no se aplican y se cuentan como errores', () => {
  const catalog = structuredClone(seedCatalog); catalog.plants[0].price = 1500;
  const rows = priceRows(catalog);
  const edits = { 'plant-1': { price: '-5' }, 'plant-2': { price: '800', unit: ' 100 g ' } };
  const summary = summarizeEdits(rows, edits, catalog);
  assert.deepEqual([summary.changed, summary.errors], [1, 1]);
  const next = applyPriceEdits(catalog, edits);
  assert.equal(next.plants[0].price, 1500, 'el inválido queda como estaba');
  assert.deepEqual([next.plants[1].price, next.plants[1].priceUnit], [800, '100 g']);
  assert.equal(applyPriceEdits(catalog, { 'plant-1': { price: '' } }).plants[0].price, undefined, 'vaciar el precio lo quita');
});
test('bajar un precio por debajo de la oferta avisa que la oferta dejará de aplicar', () => {
  const catalog = pricedCatalog();
  const rows = priceRows(catalog);
  assert.equal(summarizeEdits(rows, { 'prep-1': { price: '2400' } }, catalog).lowersPromo, 1);
  assert.equal(summarizeEdits(rows, { 'prep-1': { price: '4000' } }, catalog).lowersPromo, 0);
  const tonic = priceRows(catalog).find(r => r.id === 'prep-1');
  assert.deepEqual(tonic.categoryIds, ['tonics']);
  assert.equal(tonic.categoryLabel, 'Tónicos');
});
