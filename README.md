# Observatorio Legislativo

Portal independiente de datos abiertos para explorar las **leyes aprobadas por el Congreso Nacional de Paraguay** y **cómo votó cada diputado, senador, partido y bancada**.

> **Estado:** en desarrollo inicial. Todavía no hay sitio publicado. El avance se sigue en los [Issues](../../issues) de este repositorio.

## Qué ofrecerá

- Catálogo de leyes sancionadas en el período legislativo 2023-2028, con enlaces a la fuente oficial.
- Ficha de cada ley: quién la presentó, sus votaciones nominales y el voto de cada legislador, partido y bancada.
- Ficha de cada legislador del período: partido, bancada, sus votos en las votaciones nominales de leyes y las leyes de su autoría.
- Datos abiertos descargables.

Más adelante: clasificación por temas, indicadores de participación en votaciones, un test de afinidad basado en votaciones reales y avisos por Telegram cuando se sancione una nueva ley.

## Fuente de los datos

Todos los datos provienen de la [API de Datos Abiertos Legislativos](https://datosv2.congreso.gov.py/web/api-doc/index.html) del Congreso Nacional de Paraguay y se muestran tal como allí se publican. Ante cualquier diferencia, prevalece la fuente oficial.

**Origen de los datos: Datos Abiertos Poder Legislativo.** Los datos del Congreso se publican bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es). Este proyecto es independiente y no tiene vínculo con el Congreso Nacional ni cuenta con su aval.

Los indicadores calculados por este proyecto (porcentajes, agregados por bancada, etc.) se identifican como tales y su método se documenta.

## Datos abiertos

La copia propia de los datos está en [`datos/`](datos/), en JSON y en CSV (para abrir en una planilla), y se actualiza todos los días:

- [Leyes](datos/fuente/2023-2028/leyes.csv), [votaciones](datos/fuente/2023-2028/votaciones.csv), [votos individuales](datos/fuente/2023-2028/votos.csv), [legisladores](datos/fuente/2023-2028/legisladores.csv), [autores](datos/fuente/2023-2028/autores.csv) y [tramitaciones](datos/fuente/2023-2028/tramitaciones.csv) del período 2023-2028.
- [Diccionario de datos](datos/diccionario.md): qué significa cada columna y si es un valor oficial o calculado por este proyecto (las columnas propias empiezan con `_propio`).
- [Cómo están organizados los archivos](datos/README.md).

Se pueden reutilizar libremente bajo [CC BY 4.0](LICENSE-DATOS.md), citando "Origen de los datos: Datos Abiertos Poder Legislativo" y la fecha de actualización. Cuando el sitio esté publicado, los mismos archivos se podrán descargar desde su página `/datos/`.

## Sitio

El sitio está en [`sitio/`](sitio/): Astro con salida estática y búsqueda con Pagefind, sin servidor ni base de datos. Cómo compilarlo y cómo está organizado: [`sitio/README.md`](sitio/README.md).

## Privacidad

Este proyecto no recoge datos personales de quienes lo visitan. Solo se usarán estadísticas anónimas de visitas, sin cookies.

## Licencias

- **Código:** [GNU AGPL-3.0](LICENSE).
- **Datos derivados publicados por este proyecto:** [CC BY 4.0](LICENSE-DATOS.md), con la atribución indicada.

---

Desarrollado por Alexis Dick con asistencia de IA.
