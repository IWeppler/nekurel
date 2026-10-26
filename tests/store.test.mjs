import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCatalog, assignSlugs, comboSlug, formatMoney } from '../lib/catalog.ts';
import { buildShop } from '../lib/shop.ts';
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
