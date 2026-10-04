# Ñekurel · Biblioteca botánica

MVP para compartir el conocimiento de una herboristería. Buscador para empleados y panel de tónicos. No incluye inventario, ventas, clientes, cuentas de empleados ni generación de recetas con IA.

## Ejecutar

Requiere Node.js 22.14 o posterior. Con las dependencias instaladas:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Abrir http://localhost:3000. Para una tablet en la misma red, usar la IP de esta computadora y el puerto 3000. El servidor debe permanecer encendido y el firewall debe permitir el acceso.

## Acceso y flujo

El empleado entra directamente al buscador. El dueño usa **Administrar** y la contraseña configurada en `.env.local`. No hay cuentas de empleados.

1. Entrar a **Tónicos**. Hay ejemplos iniciales ya habilitados; revisarlos y ajustarlos.
2. Crear o editar un tónico: nombre, usos, sinónimos de búsqueda, hierbas con su proporción, preparación y advertencias. Las etiquetas se separan con comas.
3. Las hierbas se eligen con un combobox: se escribe, se elige una existente y, si no está, se agrega sola. No hay un módulo de plantas. Cada sugerencia muestra en cuántos tónicos se usa.
4. Habilitar el tónico después de revisarlo. Los borradores no los ve el equipo.
5. Buscar como empleado: se listan los tónicos que coinciden con el síntoma o la necesidad.

## Funciones

- **Buscar** por síntoma, sinónimo, nombre del tónico o nombre de una hierba. Los tónicos más consultados aparecen primero cuando no se busca nada.
- **Cliente con**: embarazo, lactancia, niños pequeños o toma de medicación. Los tónicos marcados como no recomendados en esa situación pasan al final con un aviso. El dueño los marca en cada tónico, en **No recomendado en**.
- **Calcular cantidades** (opcional): si las proporciones son del tipo `2 partes`, el detalle calcula los gramos para un total elegido.
- **Copiar o imprimir** la receta con sus advertencias.
- **Hierbas**: vista del administrador con la cantidad de tónicos que usa cada una.
- **Importar y exportar CSV** en Tónicos. Columnas: Nombre, Usos, Sinónimos, Hierbas (`Manzanilla:2 partes|Menta:1 parte`), Preparación, Advertencias, Notas, No recomendado en, Habilitado. Los tónicos se identifican por nombre; los incompletos quedan en borrador.
- **App instalable y sin conexión** (PWA): al abrirla desde el navegador se puede agregar a la pantalla de inicio. Funciona sin wifi con la última versión guardada. Requiere `npm run build` y `npm start`; en desarrollo no se activa.
- Las consultas se cuentan en `data/usage.json`.

El administrador puede **Previsualizar borradores**, con un aviso explícito. Los ejemplos provienen del brief y no constituyen indicaciones clínicas validadas. El sistema no completa ni infiere propiedades, dosis o contraindicaciones.

## Configuración

Para una nueva instalación, copiar `.env.example` a `.env.local` y definir:

```dotenv
ANKORA_ADMIN_PASSWORD=una-contraseña-propia
ANKORA_SESSION_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
# ANKORA_DATA_DIR=C:/ruta/absoluta/a/datos
```

En esta instalación se creó una contraseña local inicial: `hola123`. Cambiarla antes de exponer el servidor fuera de una red de confianza. Reiniciar el servidor tras modificar las variables. Cambiar también el secreto invalida sesiones anteriores.

La contraseña se valida en el servidor. La sesión dura 8 horas y usa una cookie HttpOnly, SameSite=Strict y firma HMAC. Las escrituras requieren sesión de administrador y el mismo origen. El acceso tiene un límite global local de 10 intentos fallidos por 15 minutos.

## Persistencia y alcance

El catálogo se guarda al primer cambio en `data/catalog.json`, fuera de Git. Todos los dispositivos consultan ese mismo archivo. La interfaz actualiza el catálogo cada 30 segundos y al recuperar foco. Hay guardado mediante reemplazo atómico, cola de escrituras y control de versión: si dos administradores editan a la vez, el segundo debe actualizar antes de guardar.

Respaldar `data/catalog.json`. El MVP está pensado para **un único proceso Node y un disco persistente**. No usar múltiples instancias ni almacenamiento efímero/serverless sin migrar a una base de datos. La consulta es accesible a quien tenga acceso al servidor, incluidas las notas internas del equipo; usarlo en la red de la herboristería. Eliminar una planta utilizada por una mezcla está bloqueado hasta quitarla de sus preparados.

## Verificar

```powershell
npm run lint
npm run build
node --experimental-strip-types --test tests/catalog.test.mjs
```

Las pruebas cubren sinónimos, normalización, coincidencias falsas, visibilidad de borradores y validación de combinaciones.

## Imágenes, hierbas independientes y WhatsApp

- Desde **Tónicos > Editar** o **Hierbas > Editar hierba**, subir una foto JPG, PNG o WebP (hasta 5 MB). Guardar la ficha para asociarla. Se puede cambiar o quitar la foto sin afectar la receta. Los archivos se guardan en `data/images/` (o en `ANKORA_DATA_DIR/images/`); respaldar esa carpeta junto con el catálogo. Las fotos son accesibles a quienes tienen acceso al servidor. Quitar una foto de una ficha no elimina el archivo, para conservar otras referencias.
- **Hierbas > Nueva hierba** permite crear fichas independientes de un tónico. Cargar usos y formas de uso (`mate`, `infusión`, etc.), propiedades, nombre científico y sinónimos. El buscador muestra tónicos y hierbas en dos grupos. Los ejemplos iniciales de Menta, Cedrón y Burrito incluyen `mate`; un catálogo ya guardado conserva sus etiquetas y se puede actualizar desde el panel.
- En el detalle de un tónico, seleccionar las hierbas que se van a incluir. El cálculo de gramos usa únicamente esa selección. Si se omiten ingredientes, completar las indicaciones de preparación para esa selección; no se cambia la receta original del dueño ni se transfieren automáticamente sus usos a la mezcla modificada.
- **Compartir por WhatsApp** pide un número con código de país, permite revisar el mensaje y abre `wa.me` con el texto precargado. El vendedor confirma el envío en WhatsApp. No se guarda el número ni se envían mensajes automáticamente. El mensaje incluye ingredientes, cantidades y advertencias; excluye notas internas. También se puede compartir la ficha de una hierba individual. Las imágenes se muestran en la aplicación; WhatsApp comparte texto, sin adjuntar las fotos.
- La columna opcional **Imagen** del CSV conserva referencias a fotos del mismo servidor. Importar un CSV antiguo sin esa columna mantiene la foto existente. El CSV no contiene los archivos de imagen.

## Entrada por rol y vista del vendedor

Al abrir la aplicación se elige **Vendedor** o **Administrador**. El vendedor entra sin contraseña al catálogo público; el administrador usa la sesión protegida existente y entra a Tónicos. La barra superior flotante se eliminó. El vendedor regresa a la selección con la X junto al buscador; el administrador usa Cambiar rol (cierra su sesión). Al recargar se vuelve a elegir el rol.

La vista del vendedor sigue la referencia móvil: fondo gris, búsqueda grande, categorías fotográficas (Mate, Hierbas, Tónicos), accesos rápidos y catálogo en filas. Hay filtros Todo/Tónicos/Hierbas y las situaciones del cliente se expanden al necesitarlas. Las fotos cargadas se muestran en las filas; si falta una foto se usa un icono. La foto decorativa de categorías está en `public/botanical-categories.png`, generada con la herramienta integrada de ImageGen. Las fotos del catálogo tienen prioridad cuando están disponibles. Las fichas, cantidades y WhatsApp conservan sus funciones.

La consulta `GET /api/catalog?scope=public` devuelve únicamente el catálogo público incluso si el navegador conserva una sesión de administrador. La selección visual de un rol no reemplaza la autorización del servidor.
