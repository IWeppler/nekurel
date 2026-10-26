# Tienda online de Ñekurel: objetivo, decisiones y plan por modelo

Este documento es el traspaso entre sesiones y modelos. Quien tome una fase debe leerlo entero, hacer solo su fase, y al terminar marcar el avance en la sección "Estado" y dejar notas en "Registro de decisiones".

**Antes de escribir código:** `AGENTS.md` avisa que esta versión de Next (16.3.8) difiere de lo conocido. Leer la guía correspondiente en `node_modules/next/dist/docs/01-app/` antes de crear rutas, páginas o metadata.

## 1. Objetivo

Convertir el catálogo público (`/catalogo`) en una tienda online simple para una herboristería, administrada por la dueña desde la app, sin cuentas de clientes ni pagos online.

La dueña debe poder, desde el administrador:

1. Cargar los datos de la tienda: WhatsApp de consultas, redes sociales, ubicación y horarios.
2. Cambiar precios de muchos productos a la vez, de forma simple.
3. Ocultar productos o categorías de la tienda sin borrarlos.
4. Armar promociones (precio de oferta) y combos (varios productos a un precio fijo).

La clienta debe poder, desde `/catalogo`:

5. Agregar productos y combos a un carrito.
6. Hacer el pedido por WhatsApp: el mensaje llega al número de la tienda con el detalle y el total.

### Fuera de alcance (por ahora)

- Pagos online, cuentas de clientes, envíos calculados.
- Guardar los pedidos en la base de datos: **los pedidos solo salen por WhatsApp**.
- **Stock.** No hay control de stock. Todo se ofrece siempre y la dueña oculta lo que no tenga. El stock es **el próximo paso** después de esta etapa; no diseñar nada que lo impida (por ejemplo, el carrito no debe asumir disponibilidad infinita en su modelo de datos, solo no consultarla todavía).

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Pedidos | Solo salen por WhatsApp. No se guardan. |
| Datos del pedido | Nombre, retiro o envío, dirección si es envío, nota opcional. |
| Promo y combo | **No se combinan.** Un producto dentro de un combo se vende al precio del combo. La promo de un producto aplica solo a compras sueltas. |
| Stock | No hay. Es el próximo paso. |
| Número de WhatsApp | Pasa de la variable `NEXT_PUBLIC_WHATSAPP_NUMBER` a un dato editable en el administrador. La variable se elimina de `.env.example` y del README al terminar la fase 2. |
| Precios | En pesos argentinos. `price` es el precio de venta; `priceUnit` es texto libre ("100 g", "bolsita"). La cantidad del carrito son unidades de ese precio. |

## 3. Estado de partida (qué existe hoy)

Ya implementado y commiteado hasta `c6b8b9d`:

- Precio de venta opcional en tónicos y hierbas (`price`, `priceUnit`), `formatPrice` en `lib/catalog.ts`, columnas de precio en el CSV, precio en WhatsApp y en la vista del vendedor.
- Campos opcionales en los formularios, etiqueta **Obligatorio**, botón Guardar con confirmación, logs `[catalog PUT]`.

Implementado y **sin commitear** al escribir este documento (revisar `git status`):

- `/catalogo` con formato tienda: `app/catalogo/page.tsx`, `app/catalogo/storefront.tsx` (buscador, chips de categoría, grilla), `app/catalogo/share-button.tsx`.
- Ficha por producto `/catalogo/[slug]` (`app/catalogo/[slug]/page.tsx`), con `slugify` y `assignSlugs` en `lib/catalog.ts`.
- `lib/shop.ts`: `loadShop()` arma los productos públicos (publicados, con categoría, slug y resumen).
- `app/whatsapp-icon.tsx`: icono de WhatsApp propio, usado en toda la app.
- Los productos sin precio muestran "Consultar".

### Cómo está armado el sistema (leer antes de tocar)

- Todo el catálogo es **un solo documento JSON** en Supabase (`app_data`, clave `catalog`). Tipos y validación en `lib/catalog.ts` (`Plant`, `Preparation`, `Catalog`, `validateCatalog`). Agregar campos **opcionales** no rompe catálogos ya guardados y no requiere migración SQL.
- Guardado con control de versión: `lib/store.ts` (`saveCatalog`, `ConflictError`) y `app/api/catalog/route.ts` (PUT solo para administrador y mismo origen).
- Lectura pública: `GET /api/catalog?scope=public` devuelve solo lo publicado. **Cualquier dato nuevo de la tienda que deba ser público tiene que agregarse ahí y nunca debe exponer lo oculto** (ver fase 4 y fase 7).
- Administrador: `app/page.tsx` (cliente, ~1300 líneas), pestañas `search | tonics | herbs`. Formularios con autoguardado: `app/auto-save-form.tsx`. Campo de precio: `PriceFields` en `app/page.tsx`.
- Categorías: `getCategories`, `itemCategories` en `lib/catalog.ts`. Cada producto se muestra bajo la primera categoría que lo incluye.
- Estilos: `app/globals.css`, una sola hoja. Radios: pastillas para controles, `--radius-card` para tarjetas. Un solo acento verde. Sin modo oscuro.
- Código: estilo denso de una línea por sentencia, comentarios solo cuando explican el porqué, textos de interfaz en español rioplatense, sin guiones largos en textos visibles.
- Tests: `node --experimental-strip-types --test tests/catalog.test.mjs tests/features.test.mjs`. Verificar también `npx tsc --noEmit` y `npx eslint app lib`.
- Service worker `public/sw.js`: subir `VERSION` cuando cambie algo que deba llegar a dispositivos con la app instalada.

## 4. Modelo de datos propuesto (lo define la fase 1)

Todos los campos nuevos son opcionales.

```ts
type StoreSettings = {
  whatsapp?: string;   // solo dígitos con código de país, 8 a 15 dígitos
  instagram?: string;  // usuario o URL
  facebook?: string;   // usuario o URL
  address?: string;    // texto
  mapsUrl?: string;    // URL https
  hours?: string;      // texto libre multilínea
};
// En Plant y Preparation:
//   hidden?: boolean        oculto en la tienda (no afecta la vista del vendedor)
//   promoPrice?: number     precio de oferta
//   promoUntil?: string     fecha límite "YYYY-MM-DD", inclusive, hora de Argentina
// En Category: hidden?: boolean
type Combo = {
  id: string; name: string; description: string; image?: string;
  items: { productId: string; qty: number }[]; // qty entero 1 a 99
  price: number; active: boolean;
};
// En Catalog: store?: StoreSettings; combos?: Combo[];
```

Reglas:

- **Precio vigente** (una sola función en `lib/`, usada por tienda, carrito y mensaje): devuelve `{ price, regular, onPromo, unit }`. La promo aplica solo si hay `price`, `promoPrice < price` y (`promoUntil` vacío o hoy ≤ `promoUntil`).
- Un producto oculto, o en una categoría oculta, no aparece en la tienda, ni en su ficha por link (404), ni en el carrito, ni en `GET /api/catalog?scope=public`.
- Un combo activo cuyo producto está oculto o fue borrado **no se muestra** (y la administración debe avisar cuál combo quedó roto).
- El ahorro de un combo se calcula contra la suma de precios regulares por cantidad, solo si todos los productos tienen precio.
- Borrar una hierba usada en un combo debe estar bloqueado, igual que hoy con los tónicos.

## 5. Carrito y pedido (lo define la fase 6)

- Vive en el navegador (`localStorage`, clave versionada). **Guarda solo ids y cantidades**; los precios se recalculan siempre desde el catálogo actual. Si un producto desapareció o se ocultó, se quita del carrito con un aviso.
- Líneas: producto suelto (`p:<id>`) o combo (`c:<id>`). Cantidad entera de 1 a 99, máximo 50 líneas.
- Un producto en "Consultar" se puede agregar. En el mensaje queda "precio a confirmar" y no suma al total. El total debe decir si hay líneas a confirmar.
- Datos del pedido: nombre (obligatorio), retiro o envío, dirección (obligatoria si es envío), nota opcional.
- Botón **Pedir por WhatsApp**: abre `https://wa.me/<número de la tienda>?text=...`. Si la tienda no cargó número, el botón no se ofrece y se explica por qué.
- El mensaje es texto plano con una línea por ítem, cantidad, unidad, subtotal y total. El largo de la URL tiene un límite práctico: si el mensaje es muy largo, advertir antes de abrir WhatsApp.
- El mensaje nunca incluye notas internas ni datos que no sean del pedido.

Ejemplo de mensaje:

```
Hola, quiero hacer un pedido en Ñekurel.

Nombre: Ana
Entrega: Envío a Calle 123

2 x Manzanilla (100 g): $ 4.000
1 x Combo Digestivo: $ 6.500
1 x Tónico calma: precio a confirmar

Total: $ 10.500 (más los productos a confirmar)
Nota: sin bolsa, por favor.
```

## 6. Fases, modelo asignado y entregables

Orden: 1, luego 2, 3 y 4 (pueden ir en paralelo), luego 5, luego 6, luego 7 y 8.

### Fase 1. Modelo de datos y precio vigente. **Opus 5.5**

**Por qué Opus:** es la decisión de diseño que condiciona todo lo demás. Un error acá se multiplica en cinco fases.

- **Objetivo:** que el catálogo pueda representar datos de tienda, ocultamiento, promociones y combos, con una única fuente de verdad para el precio.
- **Alcance:**
  1. Agregar los tipos y campos de la sección 4 en `lib/catalog.ts`.
  2. Extender `validateCatalog`: formato de `whatsapp`, URLs `https`, `promoPrice` numérico válido, `promoUntil` con formato de fecha, combos (ids existentes, cantidades enteras, precio válido, nombres únicos, límites de tamaño).
  3. Crear la función de precio vigente y la del ahorro de un combo, puras y testeadas (con la fecha como parámetro para poder testear).
  4. Crear el helper que decide si un producto es **visible en la tienda** (oculto propio o por categoría) y usarlo en `lib/shop.ts` y en `GET /api/catalog?scope=public`.
  5. Bloquear borrar una hierba usada en un combo (regla en el administrador, apoyada en una función de `lib/`).
  6. Tests en `tests/catalog.test.mjs`.
- **No hacer:** interfaces de administrador ni cambios visuales en la tienda.
- **Criterios de aceptación:** `tsc`, `eslint` y los tests pasan; un catálogo viejo sin campos nuevos valida y se comporta igual; la función de precio cubre promo vencida, promo mayor al precio, sin precio y combo con producto sin precio.
- **Entrega:** actualizar "Estado" y anotar en el registro cualquier cambio al modelo de la sección 4.

### Fase 2. Pestaña Tienda: datos de contacto. **Sonnet 5.5**

- **Objetivo:** que la dueña cargue WhatsApp, Instagram, Facebook, dirección, mapa y horarios, y que se vean en la tienda.
- **Alcance:**
  1. Nueva pestaña **Tienda** en `app/page.tsx` (o mover su contenido a un componente propio para no crecer más ese archivo) con la sección **Datos**.
  2. Formulario con autoguardado y botón Guardar, siguiendo `AutoSaveForm`. Solo el número de WhatsApp es el dato "importante" y se marca; el resto es opcional.
  3. Mostrar los datos en `/catalogo` (pie con redes, dirección con link al mapa, horarios) y un enlace de contacto en la ficha. Reemplazar el uso de `NEXT_PUBLIC_WHATSAPP_NUMBER` por el dato guardado y quitar la variable de `.env.example` y del README.
  4. Los datos de la tienda viajan en `GET /api/catalog?scope=public`.
- **Criterios de aceptación:** sin número cargado, los botones "Consultar" no aparecen y nada se rompe; con número, abren el chat correcto.

### Fase 3. Edición masiva de precios. **Sonnet 5.5**

- **Objetivo:** cambiar precios de muchos productos sin abrir ficha por ficha.
- **Alcance:** sección **Precios** de la pestaña Tienda:
  1. Tabla con todos los tónicos y hierbas: nombre, categoría, precio y unidad editables en la fila.
  2. Filtro por categoría y por texto; seleccionar varias filas.
  3. Acciones sobre la selección: subir o bajar un porcentaje, redondear a un múltiplo configurable (por ejemplo $50 o $100), fijar un precio.
  4. Los cambios quedan **pendientes** y se ven resaltados; un botón **Guardar cambios** guarda todo en una sola operación y **Descartar** los deshace. Mostrar antes del guardado cuántos productos cambian.
  5. Un solo guardado respeta el control de versión del catálogo (si hay conflicto, mostrar el mensaje existente y no perder lo editado).
- **Criterios de aceptación:** ajustar +10% a 30 productos y guardar es una sola operación; precios inválidos o negativos se rechazan en pantalla con un mensaje claro; no se pierde lo editado si falla el guardado.

### Fase 4. Ocultar productos y categorías. **Sonnet 5.5**

- **Objetivo:** que la dueña esconda cosas de la tienda sin borrarlas.
- **Alcance:**
  1. Interruptor "Visible en la tienda" en los formularios de tónico y hierba, y en el editor de categorías.
  2. Sección **Visibilidad** en Tienda: lista de lo oculto con opción de mostrar de nuevo.
  3. Aplicar la visibilidad usando el helper de la fase 1 en `/catalogo`, en `/catalogo/[slug]` (404 si está oculto) y en el API público.
  4. La vista del vendedor (app interna) **no cambia**: sigue viendo todo.
- **Criterios de aceptación:** un producto oculto da 404 en su link, no aparece en el listado ni en el API público; ocultar una categoría oculta todos sus productos sin tocar sus fichas.

### Fase 5. Promociones y combos. **Opus 5.5 (modelo) y Sonnet 5.5 (interfaz)**

**Por qué dos modelos:** la lógica de precios y la validación de combos es delicada (Opus); armar los formularios y las tarjetas es trabajo de interfaz (Sonnet).

- **Objetivo:** ofertas por producto y combos con precio fijo, visibles en la tienda.
- **Alcance:**
  1. Opus: revisar que la función de precio de la fase 1 cubra promos, definir cómo se muestra el ahorro y la regla "promo y combo no se combinan", y dejar los tests.
  2. Sonnet: campo de **precio de oferta** y **válida hasta** en los formularios; sección **Promociones y combos** en Tienda para crear, editar, activar y desactivar combos (nombre, foto, descripción, productos con cantidad, precio).
  3. Sonnet: en la tienda, precio tachado y precio de oferta, etiqueta de oferta, y una sección **Combos** con tarjetas propias (y ficha `/catalogo/combo/<slug>` o equivalente decidida por Opus; los slugs no deben chocar con los de productos).
  4. Aviso en administración si un combo quedó roto (producto oculto o borrado).
- **Criterios de aceptación:** una promo vencida deja de mostrarse sola; un combo roto no se muestra al público; el ahorro mostrado coincide con el cálculo de la fase 1.

### Fase 6. Carrito y pedido por WhatsApp. **Opus 5.5 (lógica) y Sonnet 5.5 (interfaz)**

- **Objetivo:** que la clienta arme un pedido y lo envíe por WhatsApp.
- **Alcance:**
  1. Opus: módulo del carrito en `lib/` (agregar, cambiar cantidad, quitar, reconciliar contra el catálogo actual, total con líneas a confirmar) y generador del mensaje (sección 5), puros y con tests, incluidos los casos: producto ocultado, precio cambiado, combo roto, mensaje demasiado largo, caracteres especiales.
  2. Sonnet: botón **Agregar** en tarjetas y fichas; ícono de carrito con contador en el encabezado; panel o página del carrito con cantidades, quitar, datos del pedido (nombre, retiro o envío, dirección, nota) y botón **Pedir por WhatsApp**.
  3. Persistencia en `localStorage` con manejo seguro de errores (ver las reglas de la sección 5).
- **Criterios de aceptación:** el mensaje coincide con el ejemplo de la sección 5; los precios del mensaje siempre salen del catálogo actual, nunca de lo guardado en el navegador; sin número de WhatsApp en la tienda no se ofrece el botón y se explica.

### Fase 7. Revisión final. **Opus 5.5**

- **Objetivo:** cerrar riesgos antes de publicar.
- **Revisar:** que nada oculto ni interno (notas, borradores, preparación del tónico) salga por el API público ni por las páginas de tienda (hoy el API público ya incluye `notes` de las fichas publicadas: decidir si se limpia); que los precios se recalculen en el servidor y en el cliente con la misma función; accesibilidad (foco, contraste, tamaños táctiles de 44 px); que el mensaje de pedido no permita inyectar texto confuso; comportamiento sin conexión del service worker con la tienda.
- **Entrega:** lista de hallazgos corregidos y pendientes en el registro.

### Fase 8. Tests, README y commit. **Haiku 5.5**

- Completar tests faltantes, documentar la tienda en `README.md` (datos de la tienda, precios masivos, ocultar, promociones y combos, carrito), subir la versión del service worker y commitear en commits separados por fase con la atribución habitual. No pushear sin que la persona lo pida.

## 7. Estado

Actualizar esta tabla al terminar cada fase.

| Fase | Modelo | Estado |
|---|---|---|
| 0. Commitear catálogo en grilla, fichas por slug e ícono de WhatsApp | Haiku 5.5 | Hecho (Opus 5.5) |
| 1. Modelo de datos y precio vigente | Opus 5.5 | Pendiente |
| 2. Pestaña Tienda: datos de contacto | Sonnet 5.5 | Pendiente |
| 3. Edición masiva de precios | Sonnet 5.5 | Pendiente |
| 4. Ocultar productos y categorías | Sonnet 5.5 | Pendiente |
| 5. Promociones y combos | Opus 5.5 y Sonnet 5.5 | Pendiente |
| 6. Carrito y pedido por WhatsApp | Opus 5.5 y Sonnet 5.5 | Pendiente |
| 7. Revisión final | Opus 5.5 | Pendiente |
| 8. Tests, README y commit | Haiku 5.5 | Pendiente |

## 8. Registro de decisiones y notas entre fases

(Cada fase agrega acá lo que cambió respecto del plan, con fecha y motivo.)

- 2026-10-26: plan inicial redactado. Pedidos solo por WhatsApp, sin stock (próximo paso), promo y combo no se combinan.
