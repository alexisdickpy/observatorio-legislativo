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

`npm run build` copia `datos/` a `public/datos/` (no se sube al repositorio) para servirlo en `/datos/…` con las mismas rutas, y genera en `public/fotos/` las fotos de `datos/fotos/` reducidas a 320 × 320 píxeles (`scripts/reducir-fotos.js`, con `sharp`).

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
| `/legisladores/` | Legisladores del período vigente: primero los que están en ejercicio (Senadores y luego Diputados, por apellido) y, aparte, los que ya no ejercen. Filtros por nombre, cámara, partido, bancada y departamento, que quedan en la dirección: `?q=…&camara=…&partido=…&bancada=…&departamento=…`. |
| `/legisladores/{slug}/` | Ficha de cada persona (slug de `datos/propios/personas.json`), con un bloque por período. |
| `/buscar/` | Búsqueda en las fichas con Pagefind (`?q=…`). |
| `/datos/` | Descarga de los datos abiertos. |

Los valores oficiales se muestran tal como los publica el Congreso. Las fechas ISO de `_propio` se usan solo para ordenar y para el año del filtro (se toma la fecha de sanción más antigua de los registros de cada número).

### Ficha de ley

Preparada por `src/lib/ficha.js`:

- **Autores:** del registro de autor de la API, con su partido, bancada y cámara. Para los de otra legislatura (`_propio.delPeriodo = false`) se indica también la legislatura.
- **Votaciones:** las de `_propio.idVotaciones`. Arriba, un índice de la más reciente a la más antigua; luego una sección por cámara (primero la Cámara de Senadores, la cámara alta), cada una de la más reciente a la más antigua. Cada votación tiene un ancla `#votacion-{idVotacion}`.
- **Categorías de voto** oficiales, sin fusionar. Los totales son los que publica el Congreso; las categorías sin total publicado (`MOCIÓN 1`, `MOCIÓN 2`…) se cuentan desde los votos individuales y se señalan como recuento propio.
- **Desglose por partido y bancada** con el partido y la bancada de `legisladores.json`, que la API da por período (la ficha lo avisa). Los porcentajes se calculan sobre los legisladores del grupo que figuran en la lista oficial de la votación (`votos.csv`: incluye suplentes en ejercicio, `AUSENTE` y `NO VOTA`; los senadores vitalicios no figuran), y siempre muestran el denominador: "12 de 30 (40%)".
- **Barras de colores:** una barra apilada para el total de la votación y una por partido, con leyenda (`BarraVotos` y `GraficoPartidos`, sin JavaScript). Los colores de cada categoría están en `tokens.css` (`--color-voto-…`). Los números exactos siguen en la tabla, donde los ceros se muestran como `0` en gris.
- **Votaciones de otra legislatura** (`_propio.idVotacionesOtrosPeriodos`) y **no resueltas** (`idVotacionesNoResueltas`): se avisan con enlace a SILpy.
- Las secciones de votaciones no entran en el índice de búsqueda (`data-pagefind-ignore`).
- El nombre de cada autor del período y de cada votante enlaza a su ficha de legislador; los autores de otra legislatura, a SILpy.

### Ficha de legislador

Preparada por `src/lib/legisladores.js` (criterios en la [metodología](../docs/metodologia.md#votos-y-leyes-de-cada-legislador)):

- **Datos del cargo** oficiales: cámara, tipo (`TITULAR`, `SUPLENTE`, `VITALICIO`), departamento (`NACIONAL` en los senadores), partido, bancada, cargo en la bancada y enlace a SILpy. Sin correo ni teléfono. Foto reducida, con crédito al Congreso.
- **Resumen de votos:** barra y cantidad por categoría oficial, con su denominador, sobre las votaciones nominales de leyes sancionadas en cuya lista oficial figura. AUSENTE se presenta como "ausencias en votaciones nominales".
- **Leyes de su autoría** del período, de la más reciente a la más antigua.
- **Historial de votos**, de la más reciente a la más antigua, con enlace a la votación dentro de la ficha de la ley (`rutas.votacionEnLey`). No entra en el índice de búsqueda.
