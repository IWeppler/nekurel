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
