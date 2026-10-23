# Sitio

Sitio estático hecho con [Astro](https://astro.build/) y búsqueda con [Pagefind](https://pagefind.app/). Solo presenta lo que hay en [`datos/`](../datos/): nunca consulta la API del Congreso. Las decisiones están en [`docs/decisiones/0001-arquitectura.md`](../docs/decisiones/0001-arquitectura.md).

## Uso

Requiere la versión de Node.js de [`.node-version`](.node-version). Desde esta carpeta:

```bash
npm ci                    # instalar las versiones exactas de package-lock.json
npm run dev               # sitio en desarrollo (la búsqueda no funciona en este modo)
npm run build             # compilar en dist/ y generar el índice de búsqueda
npm run preview           # ver dist/ tal como se publicará
npm test                  # pruebas del filtro de leyes
npm run test:compilacion  # comprobar dist/ después de npm run build
```

`npm run build` copia `datos/` a `public/datos/` (no se sube al repositorio) para servirlo en `/datos/…` con las mismas rutas.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/estilos/tokens.css` | Colores, tipografías y medidas: **único** lugar del aspecto visual. |
| `src/estilos/base.css` | Estilos generales que usan esos tokens. |
| `src/layouts/` | Estructura común de las páginas. |
| `src/components/` | Piezas reutilizables (tabla de leyes, filtro, pie de página…). |
| `src/pages/` | Una plantilla por tipo de página. El nombre del archivo define la URL. |
| `src/lib/` | Lectura de `datos/` y preparación de los valores para mostrar, sin HTML. |
| `src/lib/rutas.js` | **Único** lugar donde se definen las URLs. |
| `pruebas/` | Pruebas con `node --test`. |

Reglas para el rediseño (Fase 4): ningún color, tipografía ni medida fuera de `tokens.css`; ningún cálculo ni lectura de datos en los componentes; ninguna URL escrita a mano fuera de `lib/rutas.js`.

## Páginas

| URL | Contenido |
|---|---|
| `/` | Inicio. |
| `/leyes/` | Catálogo con filtros por texto, año de sanción y cámara de origen, y orden por fecha o número. Los filtros quedan en la dirección: `?q=…&anio=…&camara=…&orden=…`. |
| `/leyes/{número}/` | Ficha de la ley (`_propio.numeroLey`). Los registros con el mismo número se muestran juntos. |
| `/buscar/` | Búsqueda en las fichas con Pagefind (`?q=…`). |
| `/datos/` | Descarga de los datos abiertos. |

Los valores oficiales se muestran tal como los publica el Congreso. Las fechas ISO de `_propio` se usan solo para ordenar y para el año del filtro (se toma la fecha de sanción más antigua de los registros de cada número).
