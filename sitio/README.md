# Sitio

Sitio estático hecho con [Astro](https://astro.build/) y búsqueda con [Pagefind](https://pagefind.app/). Solo presenta lo que hay en [`datos/`](../datos/): nunca consulta la API del Congreso. Las decisiones están en [`docs/decisiones/0001-arquitectura.md`](../docs/decisiones/0001-arquitectura.md).

## Uso

Requiere la versión de Node.js de [`.node-version`](.node-version). Desde esta carpeta:

```bash
npm ci                    # instalar las versiones exactas de package-lock.json
npm run dev               # sitio en desarrollo (la búsqueda no funciona en este modo)
npm run build             # compilar en dist/ y generar el índice de búsqueda
npm run preview           # ver dist/ tal como se publicará
npm test                  # pruebas del filtro de leyes y de las fichas
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
| `/leyes/{número}/` | Ficha de la ley (`_propio.numeroLey`). Los registros con el mismo número se muestran juntos; cada uno con su iniciativa, autores y votaciones nominales. |
| `/buscar/` | Búsqueda en las fichas con Pagefind (`?q=…`). |
| `/datos/` | Descarga de los datos abiertos. |

Los valores oficiales se muestran tal como los publica el Congreso. Las fechas ISO de `_propio` se usan solo para ordenar y para el año del filtro (se toma la fecha de sanción más antigua de los registros de cada número).

### Ficha de ley

Preparada por `src/lib/ficha.js`:

- **Autores:** del registro de autor de la API, con su partido, bancada y cámara. Para los de otra legislatura (`_propio.delPeriodo = false`) se indica también la legislatura.
- **Votaciones:** las de `_propio.idVotaciones`. Arriba, un índice de la más reciente a la más antigua; luego una sección por cámara (primero la que votó más recientemente), también de la más reciente a la más antigua. Cada votación tiene un ancla `#votacion-{idVotacion}`.
- **Categorías de voto** oficiales, sin fusionar. Los totales son los que publica el Congreso; las categorías sin total publicado (`MOCIÓN 1`, `MOCIÓN 2`…) se cuentan desde los votos individuales y se señalan como recuento propio.
- **Desglose por partido y bancada** con el partido y la bancada de `legisladores.json`, que la API da por período (la ficha lo avisa). Los porcentajes se calculan sobre todos los legisladores del grupo registrados en la votación, incluidos `AUSENTE` y `NO VOTA`, y siempre muestran el denominador: "12 de 30 (40%)".
- **Votaciones de otra legislatura** (`_propio.idVotacionesOtrosPeriodos`) y **no resueltas** (`idVotacionesNoResueltas`): se avisan con enlace a SILpy.
- Las secciones de votaciones no entran en el índice de búsqueda (`data-pagefind-ignore`).
