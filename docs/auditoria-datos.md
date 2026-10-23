# Auditoría de la API y de la cobertura de datos (2023-2028)

**Fecha de la medición:** 22 de octubre de 2026.
**Fuente:** [API de Datos Abiertos Legislativos v2](https://datosv2.congreso.gov.py/web/api-doc/index.html) (`https://datosv2.congreso.gov.py/web/api`), licencia CC BY 4.0. Origen de los datos: Datos Abiertos Poder Legislativo.
**Alcance:** período legislativo 2023-2028 (cuatro períodos parlamentarios anuales, del 01/07/2023 en adelante), leyes sancionadas, votaciones nominales, legisladores y autores.

Este informe distingue tres tipos de afirmaciones:

- **Hecho verificado:** medido con los scripts de este repositorio sobre la respuesta real de la API.
- **Inferencia:** interpretación razonable de los datos que no está documentada por la fuente.
- **Pregunta abierta:** algo que los datos no permiten responder.

Todas las cifras salen de [`docs/auditoria/cifras.json`](auditoria/cifras.json). Los ejemplos de problemas de calidad están en [`docs/auditoria/problemas.json`](auditoria/problemas.json) y los ejemplos de respuestas reales en [`docs/auditoria/ejemplos/`](auditoria/ejemplos/), sin datos de contacto. La sección [Cómo reproducir](#cómo-reproducir) explica cómo regenerarlos.

## Resumen

1. **Las leyes están completas y bien enlazadas.** Hay 556 registros de ley sancionados entre el 12/07/2023 y el 31/08/2026, que corresponden a 541 números de ley distintos. Todos tienen su proyecto, su iniciativa y, salvo uno, el texto de la ley en PDF.
2. **Las votaciones nominales se enlazan a las leyes sin ambigüedad**, por el identificador del trámite (`idTramitacion`). Sin embargo, la cobertura es muy desigual entre cámaras. Diputados tiene votación nominal publicada para 441 de los 556 registros de ley, y el Senado solo para 100.
3. **Los votos individuales son completos y coherentes.** Son 82.680 votos en 1.165 votaciones del período, con un registro por cada miembro de la cámara y sin legisladores faltantes ni repetidos.
4. **No existen datos oficiales de asistencia a sesiones.** "AUSENTE" en una votación solo indica que no votó en ese momento.
5. **El test de afinidad es viable**, con al menos 33 votaciones disputadas en Diputados y 48 en el Senado (el mínimo pedido era 12 y lo ideal, 24).
6. **La API no informa cuándo se modificó un registro.** Para la actualización diaria hay que comparar descargas.
7. **Hay problemas de calidad acotados y manejables:**
   - números de ley repetidos;
   - totales de votación que no cuadran;
   - nombres de partidos y bancadas sin normalizar;
   - horas de sesión imposibles;
   - un endpoint roto (votaciones por legislador).

## 1. Funcionamiento de la API

**Hechos verificados:**

- **Consultas.** Todas son `GET` sobre `https://datosv2.congreso.gov.py/web/api/<recurso>`. La especificación OpenAPI está en `/web/api/openapi.json` (no en `/web/api/api/...`).
- **Formato de respuesta.**
  - Todas las respuestas usan el mismo envoltorio: `{"codigoEstado", "mensaje", "datos"}`.
  - `datos` es una lista incluso cuando se pide un solo elemento (por ejemplo `/proyecto/{id}`).
  - Cuando no hay datos, la API responde HTTP 404 con un cuerpo JSON válido: `{"codigoEstado":404,"mensaje":"Dato/s no encontrado/s","datos":null}`.
- **Paginación.** En `/ley`, `/votacion` y `/proyecto`, el parámetro `offset` es **el número de página empezando en 1**, no la cantidad de registros a saltar. `limit` es el tamaño de página.
  - `offset=0` devuelve 404.
  - Una página más allá del final también devuelve 404.
  - Funcionan páginas de al menos 500 leyes o 100 votaciones.
- **Codificación.** Las respuestas están en UTF-8 válido, sin caracteres de reemplazo. Las tildes y la ñ llegan bien.
- **Fechas y horas.** Llegan como texto (`dd/mm/aaaa` y `hh:mm`), no como fechas ISO.
- **Rendimiento.**
  - Una página de 100 votaciones con todos sus votos pesa unos 4,7 MB y tarda unos 9 segundos.
  - La descarga completa para esta auditoría hizo unas 1.300 consultas, con una pausa de 0,3 s entre ellas, y ocupa 154 MB en crudo.
- **Cámaras.** En los endpoints que piden cámara, el identificador es una letra: `S` (Senado), `D` (Diputados) o `A` (ambas).
- **Endpoints usados y que funcionan:**
  - `periodo`;
  - `ley/periodo/{id}` y `ley`;
  - `votacion`;
  - `legislador/camara/{S|D}` y `legislador?idCamara=A`;
  - `proyecto/{id}/tramitaciones`, que además incluye autores, ministerios y adjuntos de la iniciativa;
  - `proyecto/{id}/adjuntos`;
  - `sesion/periodo/{id}?idCamara=`;
  - `sesion/{id}`.
- **Endpoint roto:** `votacion/parlamentario/{idLegislador}`. Para los 127 legisladores vigentes devuelve un único registro, y es siempre el mismo: la votación 100040, de 2017. No sirve para obtener el historial de un legislador. Ese historial se arma desde el listado general de votaciones. Ejemplo en [`ejemplos/votacion_por_legislador.json`](auditoria/ejemplos/votacion_por_legislador.json).

Los períodos parlamentarios de 2023-2028 son 100217 (2023-2024), 100237 (2024-2025), 100257 (2025-2026) y 100267 (2026-2027).

## 2. Leyes del período

**Hechos verificados:**

| Período parlamentario | Registros de ley |
|---|---|
| 2023-2024 | 151 |
| 2024-2025 | 201 |
| 2025-2026 | 174 |
| 2026-2027 (en curso) | 30 |
| **Total** | **556** |

- **Fechas de sanción:** la primera es del 12/07/2023 y la última del 31/08/2026.
- **Consistencia entre endpoints.**
  - El listado general `/ley` tiene 4.368 leyes de todas las épocas. Las que tienen fecha de sanción desde el 01/07/2023 son exactamente las mismas 556 que devuelve `ley/periodo`, sin ninguna faltante.
  - Ningún registro del período tiene fechas vacías o mal formadas.
- **Iniciativa:** 383 parlamentaria, 168 Poder Ejecutivo y 5 Corte Suprema de Justicia.
- **Cámara de origen:** 280 Senado y 276 Diputados.
- **Promulgación:** 463 normal y 93 automática.
- **Varios registros por número de ley.** Los 556 registros corresponden a **541 números de ley distintos**. Cuando una ley se sanciona a partir de varios proyectos acumulados, la API crea un registro de ley por cada proyecto, con el mismo número. Hay 12 números con más de un registro. El caso extremo es la Ley 7322, con 4 registros (ver `problemas.json`).
  - **Consecuencia para el sitio:** la ficha de una ley debe agrupar por número de ley y mostrar todos sus proyectos.
- **El identificador no sigue el orden cronológico.** El orden de `idLey` no coincide con el de las fechas de sanción: hay 194 inversiones en 555 pares consecutivos. No sirve como indicador de "lo más nuevo".
- **Fechas imposibles en leyes antiguas.** Fuera del período hay 2 fechas de sanción con años imposibles: Ley 4678 con "29/11/0012" y Ley 5543 con "26/11/0215". No afectan al período 2023-2028, pero el importador debe validar fechas.

**Inferencia:** la última ley registrada es del 31/08/2026, mientras que la última votación es del 14/10/2026. Puede haber un retraso de semanas entre la sanción de una ley y su carga en la API.

### Acápite como descripción breve

**Hechos verificados:**

- **Longitud:** el acápite (título oficial del proyecto) tiene entre 84 y 1.224 caracteres, con una mediana de 330. Hay 317 con más de 300 caracteres.
- **Autores al final del texto:** 383 incluyen al final "presentado por …" con la lista de autores.
- **Prefijo innecesario:** 166 empiezan con "Proyecto de Ley".
- **Mayúsculas y comillas mezcladas:** muchos están en mayúsculas y usan comillas de distintos tipos.

**Inferencia:** el acápite sirve como título de la ley si se limpia: quitar el prefijo "Proyecto de Ley", quitar la cola "presentado por …" (los autores ya vienen estructurados aparte) y normalizar las mayúsculas. No sirve como descripción breve en lenguaje sencillo. Eso corresponde a la Fase 4.

### Textos adjuntos

**Hechos verificados:**

- **Texto de la ley:** 555 de 556 registros tienen el texto oficial de la ley (554 en PDF y 1 en ZIP). Un registro no tiene ningún adjunto.
- **Otros adjuntos:**
  - el texto de la iniciativa, en PDF, Word, imagen JPEG, Excel o ZIP;
  - la "sanción completa", mayormente en Word.
- **Enlaces de descarga:** apuntan a `https://datosv2.congreso.gov.py/opendata/descarga?id=…`.

## 3. Votaciones nominales

**Hechos verificados:**

- **Total en la API:** 2.745 votaciones de todas las épocas, prácticamente todas desde 2018. Hay una sola de 2017.
- **Del período 2023-2028:** 1.165 votaciones, 865 de Diputados y 300 del Senado. Un voto pertenece al período si su sesión pertenece a un período parlamentario de 2023-2028, lo que incluye la sesión preparatoria del 30/06/2023.
- **Tipo de expediente:** 1.004 de las 1.165 son sobre proyectos de ley. El resto son resoluciones, acuerdos constitucionales, designaciones, pedidos de informe, etc.

### Etapa de cada votación

La etapa no está en un campo propio. El Senado suele escribirla en `descripcion`, y Diputados en `observacion` (por ejemplo "(Si) Aprobación en general (No) Rechazo Resultado: Aprobado"). El script la clasifica combinando esos dos textos con la subetapa del trámite (`descripcionSubEtapa`). Esa clasificación es una inferencia basada en reglas de texto.

| Etapa (clasificación del script) | Diputados | Senado |
|---|---|---|
| En general | 442 | 89 |
| En general y en particular (votación única) | 134 | 4 |
| En particular (artículos) | 18 | 10 |
| 3.º/4.º trámite (modificaciones o ratificación) | 144 | 61 |
| Objeción del Poder Ejecutivo | 54 | 24 |
| Sin etapa explícita | 73 | 112 |

En "sin etapa explícita" del Senado predominan textos del tipo "La Presidencia somete a votación electrónica el proyecto de ley", elecciones de autoridades, ternas y acuerdos constitucionales.

### Votos individuales

**Hechos verificados:**

- **Volumen:** 82.680 votos individuales en las 1.165 votaciones del período.
- **Un registro por cada miembro, siempre.** Cada votación trae un registro por miembro de la cámara, haya votado o no: 80 en Diputados (862 votaciones; 3 con 79) y 45 en el Senado (287 votaciones; 9 con 44 y 4 con 43).
- **Sin errores de identificación:** ningún voto carece de legislador y ninguna votación repite a un legislador.
- **Categorías reales,** cada una con un identificador numérico estable (`idSentidoVotacion`):

| Código | Sentido | Votos | Diputados | Senado |
|---|---|---|---|---|
| 272 | SI | 39.533 | 47,9 % | 47,3 % |
| 273 | NO | 11.024 | 12,6 % | 17,1 % |
| 274 | ABSTENCIÓN/BLANCO | 1.838 | 2,1 % | 2,8 % |
| 275 | AUSENTE | 28.881 | 37,2 % | 23,3 % |
| 276 | NO VOTA | 950 | — | 7,0 % |
| 281-283 | MOCIÓN 1 / 2 / 3 | 454 | 0,1 % | 2,5 % |

- **Legisladores que votaron:** 140 distintos en el período. Son 125 de los 127 vigentes (los 2 senadores vitalicios no votan) y 15 que votaron en algún momento y ya no figuran como vigentes. Estos últimos son reemplazos, renuncias o suplentes que dejaron el cargo.
  - **Consecuencia:** el sitio debe incluir también a esos 15 legisladores en sus fichas de votación.

**Inferencias y preguntas abiertas:**

- **Significado de las categorías.** La API no documenta su significado.
  - **Inferencia:** "AUSENTE" significa que el legislador no estaba registrado en el sistema de votación en ese momento, aunque pudiera estar en la sesión.
  - **Inferencia:** "NO VOTA", que solo aparece en el Senado, significa presente sin emitir voto.
  - **Inferencia:** las "MOCIONES" son votaciones entre propuestas alternativas, por ejemplo la elección de autoridades.
  - **Pregunta abierta:** confirmar estos significados con la fuente. Mientras tanto, la métrica se llamará "ausencias en votaciones nominales" y no "ausencias a sesiones".
- **Totales que no cuadran.** En 13 votaciones del período, la suma de los totales (`totalSI`, `totalNO`, etc.) no coincide con la cantidad de registros individuales. Ejemplo: la votación 104665 suma 22 en los totales y tiene 80 registros.
  - **Recomendación:** recalcular siempre los totales desde los votos individuales y no usar los totales publicados.
- **Menos registros que miembros.** En 16 votaciones hay menos registros que miembros de la cámara (43 o 44 en el Senado, 79 en Diputados).
  - **Pregunta abierta:** si faltan votos o si había bancas vacantes.
- **Votos registrados de forma parcial.** Algunas votaciones aclaran en la observación que el registro es parcial. Ejemplo: "Por restricción del sistema solamente se registra la votación de la ganadora…".

## 4. Enlace entre leyes y votaciones

**Hechos verificados:**

- **El enlace es exacto.** Cada votación trae su `proyecto.idProyecto` y su `tramitacion.idTramitacion`. Las 696 votaciones de proyectos que terminaron en ley figuran en las tramitaciones de su proyecto, sin ninguna discrepancia.

| Medida | Registros de ley (de 556) |
|---|---|
| Con al menos una votación nominal | 458 |
| Con al menos una votación nominal en Diputados | 441 |
| Con al menos una votación nominal en el Senado | 100 |
| Con votación nominal en ambas cámaras | 83 |
| Con votación de aprobación global en Diputados ("en general" o "en general y en particular") | 421 |
| Con votación de aprobación global en el Senado | 53 |
| Con votación de aprobación global en ambas cámaras | 37 |
| Sin ninguna votación nominal | 98 (33 del Ejecutivo, 64 parlamentarias, 1 de la Corte) |

- **Por número de ley:** 446 de los 541 números tienen al menos una votación nominal y 95 no tienen ninguna.
- **Votos de la legislatura anterior:** 54 votaciones de leyes sancionadas en el período son anteriores a julio de 2023, porque el proyecto se trató en parte en la legislatura anterior.
- **Votaciones nominales por semestre en el período:** el Senado registra entre 14 y 91, frente a entre 54 y 200 de Diputados.

**Respuesta a la pregunta del Issue:**

- **En Diputados**, se puede identificar con fiabilidad la votación de aprobación en general en la gran mayoría de las leyes (421 de 556).
- **En el Senado**, solo en 53 de 556.

**Inferencia:** el Senado registra como votación nominal en el sistema solo una parte de lo que vota. El resto probablemente se vota sin registro individual publicado.

**Pregunta abierta:** confirmar con la fuente si esas votaciones existen en otro formato (por ejemplo, en los diarios de sesiones) o si no hubo votación nominal.

**Consecuencia para el sitio:** la ficha de ley debe decir claramente "no hay votación nominal publicada para esta cámara" en lugar de dejar el espacio vacío. Los indicadores del Senado se basarán en muchas menos votaciones que los de Diputados, y eso debe explicarse en la metodología.

## 5. Legisladores vigentes

**Hechos verificados:**

- **Vigentes según `legislador/camara/{S|D}`:** 127.
  - **Diputados, 80:** 78 titulares y 2 suplentes en ejercicio.
  - **Senado, 47:** 37 titulares, 8 suplentes en ejercicio y 2 senadores vitalicios. Los vitalicios son expresidentes que tienen voz pero no voto, y por eso el Senado vota con 45 miembros.
- **Listado histórico.** `legislador?idCamara=A` tiene 1.019 registros de todos los períodos desde 1968. De ellos, 143 son de 2023-2028: los vigentes más los que dejaron el cargo.
- **Datos disponibles por legislador:** nombre, cámara, departamento, partido, bancada, cargo en la bancada, tipo (titular, suplente o vitalicio), período, foto y enlace a su ficha oficial.
  - Ninguno carece de departamento ni de foto.
  - 2 no tienen bancada.
- **El identificador cambia en cada legislatura.** El `idLegislador` es distinto para cada persona en cada período: ninguna de las 164 personas que aparecen en más de un período conserva el mismo identificador. Por ejemplo, un expresidente figura con un identificador en 2013-2018 y con otro como vitalicio en 2023-2028. El voto de cada período usa el identificador de ese período.
  - **Consecuencia para la Fase 5 (#15):** unir el historial de una misma persona entre legislaturas exige una tabla de equivalencias propia. No viene en la API.
- **Partido y bancada sin normalizar.**
  - Hay 12 valores de partido para 127 legisladores, con variantes del mismo partido escritas distinto. Por ejemplo, "Partido Cruzada Nacional" y "CRUZADA NACIONAL", o "INDEPENDIENTE" e "Independiente A".
  - Hay 35 valores de bancada, con nomenclaturas distintas en cada cámara.
  - **Consecuencia:** para comparar por partido o por bancada hará falta una tabla de normalización documentada.
- **Sin historial de afiliación.** El partido y la bancada son un único valor por legislador y período. La API no registra cambios de bancada con fecha, y los votos llevan el valor actual, no el del día de la votación. Esto confirma la limitación que ya estaba prevista para la metodología.

## 6. Autores e iniciativa

**Hechos verificados:**

- **Iniciativa parlamentaria (383 registros de ley):** todas tienen autores estructurados.
  - Hay 1.386 registros de autoría y 257 autores distintos.
  - 993 de esos registros corresponden a legisladores vigentes y 346 a legisladores de la legislatura anterior (proyectos presentados antes de 2023).
  - Todos los autores se pueden enlazar con el listado de legisladores.
- **Iniciativa del Poder Ejecutivo (168):** ninguna tiene legisladores como autores. 164 indican el ministerio que la remite, en el campo `ministerios`.
- **Iniciativa de la Corte Suprema de Justicia:** 5.

## 7. Asistencia a sesiones

**Hecho verificado:** no hay ningún endpoint de asistencia. `sesion/{id}` devuelve solo fecha, horas, número, tipo, cámara y enlace. Los campos de acta, diario de sesiones y orden del día que figuran en la especificación no vienen en la respuesta de la sesión consultada (110892).

**Conclusión:** no se publicarán indicadores de asistencia a sesiones, solo de votaciones nominales.

**Datos de sesiones disponibles:**

| Período parlamentario | Diputados | Senado |
|---|---|---|
| 2023-2024 | 62 | 65 |
| 2024-2025 | 78 | 57 |
| 2025-2026 | 69 | 58 |
| 2026-2027 (en curso) | 30 | 18 |

Hay 14 sesiones con hora de fin anterior a la de inicio. Por ejemplo, de 09:00 a 00:00, o de 14:00 a 11:48.

## 8. Votaciones elegibles para el test de afinidad

Criterio aplicado: votaciones del período, de aprobación global de un proyecto ("en general" o "en general y en particular"), en las que la opción minoritaria entre SI y NO obtuvo al menos el 10 % de esos votos (votaciones disputadas, no unánimes).

| Criterio | Diputados | Senado |
|---|---|---|
| Aprobación global, proyecto de ley, minoría ≥ 10 % | 33 | 48 |
| Aprobación global, cualquier tipo, minoría ≥ 25 % | 14 | 29 |
| Cota superior: cualquier votación de proyecto de ley, minoría ≥ 10 % | 69 | 111 |

**Conclusión:** se supera el ideal de 24 votaciones en cada cámara con el criterio más estricto de los dos primeros (33 y 48). La selección final debe ser manual: temas comprensibles, sin duplicar el mismo asunto y repartidos en el tiempo.

## 9. Detección de leyes y votaciones nuevas o modificadas

**Hechos verificados:**

- **Sin fecha de modificación.** Ningún esquema de la API tiene un campo de fecha de modificación o de carga.
- **Leyes.** `ley/periodo/{periodo actual}` es pequeño: 30 registros, unos 28 KB.
- **Votaciones.**
  - El listado `/votacion` está ordenado por `idVotacion` creciente: la última página contiene los identificadores más altos.
  - Las fechas no están en orden: hay 305 inversiones, es decir, votaciones cargadas fuera de orden cronológico.

**Recomendación:**

1. **Cada día:**
   - descargar `ley/periodo/{periodo actual}` completo y compararlo con la copia propia por `idLey`;
   - descargar las últimas páginas de `/votacion` desde el mayor `idVotacion` conocido;
   - descargar el detalle (`tramitaciones`, `adjuntos`) solo de los proyectos nuevos.
2. **Cada semana:** descarga completa (unos 130 MB y unos minutos) para detectar correcciones en registros ya existentes, porque la API no las señala.
3. **Avisos:** una ley nueva es un `idLey` que no estaba en la copia anterior. Agrupar por número de ley evita avisar dos veces la misma ley.

## 10. Problemas de calidad de datos

| Problema | Alcance | Ejemplo | Tratamiento propuesto |
|---|---|---|---|
| Un número de ley con varios registros (proyectos acumulados) | 12 números, 27 registros | Ley 7322: 4 registros | Agrupar por número de ley |
| Totales de votación que no cuadran con los votos | 13 votaciones | Votación 104665: totales 22, registros 80 | Recalcular desde los votos individuales |
| Menos registros que miembros | 16 votaciones | Votación 104206: 43 de 45 | Mostrar tal cual y anotarlo |
| Senado con pocas votaciones nominales | 100 de 556 registros de ley | — | Aviso explícito en ficha y metodología |
| Etapa de la votación sin campo propio | todas | Diputados la escribe en `observacion` | Clasificar con reglas documentadas |
| Partidos y bancadas escritos de forma distinta | 12 partidos, 35 bancadas | "CRUZADA NACIONAL" / "Partido Cruzada Nacional" | Tabla de normalización |
| Partido y bancada sin fecha | todos | — | Aviso en la metodología |
| Identificador de legislador distinto por legislatura | 164 personas | — | Tabla de equivalencias (Fase 5) |
| Fechas de sanción con años imposibles | 2 leyes antiguas | "29/11/0012" | Validar fechas en el importador |
| Sesiones con hora de fin anterior a la de inicio | 14 sesiones | 14:00–11:48 | No usar la duración de las sesiones |
| Endpoint de votaciones por legislador roto | 127 de 127 | Siempre devuelve la votación 100040 | No usarlo |
| Acápites largos, con autores al final y mayúsculas | 317 con más de 300 caracteres | — | Limpieza del título |

## 11. Recomendación de arquitectura mínima y costes (insumo para #2)

Esta recomendación es preliminar. La decisión se toma y se documenta en #2.

**Volumen de datos (inferencia a partir de las cifras):**

- **Votos:** una vez normalizados (votación, legislador, sentido), los 82.680 votos del período ocupan unos pocos MB en CSV o JSON.
- **Leyes, legisladores y votaciones:** menos de 1 MB.
- **Conclusión:** caben sin problema en el propio repositorio y en un sitio estático.

**Propuesta:**

1. **Importador** en Python con solo la biblioteca estándar, como los scripts de esta auditoría. Hace la descarga incremental diaria y la completa semanal, y genera archivos normalizados (leyes, votaciones, votos, legisladores, autores) versionados en el repositorio. Esto deja un historial público de cambios.
2. **Automatización** con GitHub Actions programado una vez al día. Es gratuito para repositorios públicos; los límites se verifican en #2.
3. **Sitio estático** generado a partir de esos archivos y publicado en Cloudflare Pages.
   - Se estiman unas 2.000 páginas: unas 541 leyes, unos 140 legisladores y las votaciones con página propia.
   - Los límites del plan gratuito (archivos por despliegue, compilaciones por mes) se verifican en #2.
4. **Sin base de datos ni servidor.** La búsqueda básica puede hacerse en el navegador con un índice estático.
5. **Diseño a futuro:** separar datos, lógica y presentación para permitir el rediseño de la Fase 4 (#14), y tratar el período legislativo como un dato más para sumar legislaturas en la Fase 5 (#15).

**Coste recurrente estimado:** cero, salvo el dominio propio, siempre que se mantengan los planes gratuitos de GitHub y Cloudflare.

## 12. Preguntas abiertas para la fuente oficial

1. ¿Por qué el Senado tiene votación nominal publicada solo para una minoría de las leyes? ¿Existen esas votaciones en otro formato?
2. ¿Qué significan exactamente AUSENTE, NO VOTA y MOCIÓN 1/2/3?
3. En las votaciones donde los totales no coinciden con los votos individuales, ¿cuál es el dato correcto?
4. ¿Hay un retraso habitual entre la sanción de una ley y su carga en la API?
5. ¿Se corregirá el endpoint `votacion/parlamentario/{id}`?
6. ¿Se publican, o se publicarán, las listas de asistencia a las sesiones de cada cámara? Hoy solo está la categoría AUSENTE de las votaciones nominales.

## Cómo reproducir

Desde la raíz del repositorio, con Python 3.10 o posterior y sin dependencias externas:

```bash
python scripts/auditoria/descargar.py
python scripts/auditoria/analizar.py
```

- `descargar.py` guarda cada respuesta de la API en `tmp/auditoria/cache/`. Esa carpeta no se sube al repositorio.
- `analizar.py` trabaja solo con esa caché y regenera `docs/auditoria/cifras.json`, `problemas.json` y los ejemplos.
- Para medir datos nuevos, borrar `tmp/auditoria/cache/` antes de descargar. Las cifras cambiarán solo si el Congreso publicó o corrigió datos.
