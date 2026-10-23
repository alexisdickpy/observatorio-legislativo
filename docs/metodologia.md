# Metodología

Este documento reúne los criterios propios del proyecto, con el detalle técnico de cada archivo. El sitio publica una versión en lenguaje simple en `/metodologia/` (`sitio/src/pages/metodologia.astro`), con las observaciones sobre los datos generadas desde `datos/propios/notas.json` en cada compilación. Si cambia un criterio, actualizar los dos.

## Principio: fidelidad a la fuente

Los datos se guardan y se muestran tal como los publica el Congreso, aunque tengan errores. Ningún valor oficial se corrige ni se sobrescribe. Cuando un dato tiene un problema conocido, se conserva el original y se agrega una nota o un campo calculado, siempre señalado como propio del proyecto (clave `_propio` en los archivos de [`datos/`](../datos/README.md)).

## Transformaciones del importador

Cada una se aplica en una capa aparte que no borra el original.

| # | Transformación | Motivo | Dónde queda |
|---|---|---|---|
| 1 | **Fechas a ISO.** Cada fecha `dd/mm/aaaa` se convierte a `aaaa-mm-dd`. Una fecha mal formada (por ejemplo, un año imposible como `0012`) no se corrige: su versión ISO queda vacía y se registra una nota. | Ordenar y comparar fechas. | `_propio.<campo>` junto al campo original; notas de tipo `fecha_mal_formada`. |
| 2 | **Número de ley sin espacios alrededor.** | Agrupar los registros de una misma ley y formar su URL. En el histórico hay un número publicado como `" 6128"`. | `_propio.numeroLey` en leyes. |
| 3 | **Votos individuales en una tabla aparte.** La lista de votos que la API incluye en cada votación se guarda en `votos.csv`, una fila por voto. Del legislador se guarda solo su `idLegislador`; sus datos están en `legisladores.json`. | Tamaño y facilidad de uso. No se pierde ningún valor de los votos. | `votos.csv`. |
| 4 | **Tramitaciones en un archivo aparte.** | Representan casi el 80 % del tamaño del detalle de las leyes. | `tramitaciones.json`. |
| 5 | **Recuento de votos.** Se cuentan los votos individuales por sentido y se comparan con los totales publicados, categoría por categoría. | Los totales publicados no incluyen las mociones (ver abajo). | `_propio.totalesRecalculados` y `_propio.totalesCoinciden` en votaciones; notas `totales_no_coinciden`. |
| 6 | **Enlace entre ley y votación.** Una votación se enlaza con una ley si es del mismo proyecto **y** su trámite (`idTramitacion`) figura entre las tramitaciones publicadas del proyecto. Si es del mismo proyecto pero el trámite no figura, el enlace queda como no resuelto: no se adivina. | Mostrar las votaciones de cada ley. | `_propio.idVotaciones` e `idVotacionesNoResueltas` en leyes; `_propio.idLeyes` y `enlaceLey` en votaciones. |
| 7 | **Votaciones del período.** Una votación pertenece al período si su sesión pertenece a uno de sus períodos parlamentarios anuales. Las votaciones de leyes del período que se hicieron en la legislatura anterior se listan en la ley, pero no se incluyen. | Mantener cada período en su carpeta. | `_propio.idVotacionesOtrosPeriodos` en leyes. |
| 8 | **Slug de cada persona.** Se forma con nombres y apellidos, sin tildes y en minúsculas (por ejemplo, `maria-rocio-abed-de-zacarias`). Si dos personas coinciden, la segunda recibe `-2`. Una vez asignado no cambia, aunque la fuente corrija el nombre. | El `idLegislador` cambia en cada legislatura y no sirve como identificador estable de la URL. | `propios/personas.json`; `_propio.slug` en legisladores y autores. |
| 9 | **Legisladores que solo aparecen en votaciones.** Si alguien vota en el período y no figura en los listados de legisladores, se incluye con los datos que trae el voto. | No dejar votos sin legislador. | `_propio.fuenteRegistro = "votacion"`; notas `legislador_solo_en_votaciones`. |
| 10 | **Correo y teléfono solo en `legisladores.json`.** La API los repite en cada copia del legislador dentro de autores, leyes y votaciones; ahí se omiten. | Guardarlos una sola vez, en el registro del legislador, que es donde la ficha los muestra (decidido en #8). | `legisladores.json` y `.csv`. |
| 12 | **Copia propia de las fotos.** La foto que publica el Congreso en el `fotoURL` de cada legislador se guarda sin cambios. Si no tiene foto (`noimage`), no se guarda nada. Si una descarga falla, se conserva la copia anterior y se avisa, sin detener la sincronización. El sitio muestra una versión reducida (320 × 320 píxeles) generada en cada compilación. | Que las fichas no dependan del servidor del Congreso en cada visita ni conecten al visitante con él. | `fotos/{período}/{idLegislador}.jpg`. |
| 11 | **Orden fijo** de registros y claves. Los votos se ordenan por `idDetalleVotacion`, las tramitaciones por `idTramitacion` y los adjuntos por `idAdjunto`. Los autores conservan el orden de la API, que se mantuvo igual en tres descargas. | La API devuelve esas listas en distinto orden en cada consulta, sin que cambien los datos. Con orden fijo, una descarga sin cambios produce los mismos archivos y el historial del repositorio muestra solo cambios reales de la fuente. | Todos los archivos. |

No se aplican, por ahora, la unificación de nombres de partidos y bancadas ni la clasificación de la etapa de cada votación. Se harán en sus propios Issues, también en `datos/propios/`.

## Nombres conocidos de partidos

Algunos partidos son más conocidos por otro nombre que el oficial. En ese caso, el sitio muestra el nombre oficial tal como lo publica la API y, entre paréntesis, el nombre conocido, con un aviso de que es un agregado del sitio. Hoy hay uno: «Movimiento Conciencia Democrática Nacional (Yo Creo)», porque las bancadas oficiales de sus legisladores llevan ese nombre. La lista y el fundamento de cada caso están en [`datos/propios/partidos.json`](../datos/propios/partidos.json). No se unifican partidos ni se cambia ningún valor oficial.

## Notas sobre la fuente

El importador registra en `datos/propios/notas.json` los problemas que detecta. Cada nota indica su tipo, el registro afectado y, si corresponde, el valor original.

| Tipo | Significado |
|---|---|
| `fecha_mal_formada` | Una fecha que no es válida. |
| `totales_no_coinciden` | Un total publicado de la votación no coincide con el recuento de votos individuales. |
| `menos_votos_que_miembros` | La votación tiene menos votos individuales que miembros con voto de la cámara (45 en el Senado, 80 en Diputados). Puede deberse a bancas vacantes; la fuente no lo aclara. |
| `legislador_repetido_en_votacion` | Un legislador figura más de una vez en la misma votación. |
| `voto_sin_legislador` | Un voto individual no identifica al legislador. |
| `legislador_solo_en_votaciones` | Ver la transformación 9. |
| `enlace_no_resuelto` | Ver la transformación 6. |
| `proyecto_sin_tramitaciones`, `proyecto_sin_adjuntos` | La API no devuelve ese detalle del proyecto. |
| `numero_ley_repetido_en_otro_periodo` | El número de una ley del período también figura en otra legislatura. |
| `numero_ley_ausente_en_historico` | Un número de ley del período no figura en el listado histórico. |
| `ley_del_periodo_fuera_de_listado` | Una ley sancionada dentro del período, según el histórico, no figura en el listado del período. |

Las notas con `"origen": "manual"` se escriben a mano y el importador las conserva.

## Totales de votación y mociones

La [auditoría](auditoria-datos.md) encontró 13 votaciones en las que la suma de los totales publicados no coincide con la cantidad de votos individuales. Al comparar categoría por categoría, el importador comprobó que en todas los totales publicados son correctos: la diferencia son los votos "MOCIÓN 1/2/3", que no tienen un total propio en la API. Por eso la comparación se hace por categoría y no por la suma.

## Votos y leyes de cada legislador

La ficha de cada legislador resume sus votos en las votaciones nominales del período sobre proyectos de ley (`proyecto.tipoProyecto` = `PROYECTO DE LEY`, o enlazadas a una ley sancionada en `_propio.idLeyes`) en cuya lista oficial figura (`votos.csv`), hayan llegado a ser ley o no. Cada categoría oficial se cuenta por separado, sin fusionar, y siempre con su denominador, por ejemplo "54 de 130 (41,5%)". La cantidad de AUSENTE de estas votaciones se muestra como una categoría más. La cifra de ausencias se calcula aparte (ver la sección siguiente).

No se incluyen las votaciones sobre otros tipos de expediente (resoluciones, declaraciones, pedidos de informe, acuerdos, designaciones y demás). Los senadores vitalicios no figuran en las listas de votación, así que su ficha no tiene votos.

Cada votación lleva el estado oficial del proyecto (`proyecto.estadoProyecto`), el de la última actualización de los datos y no el del día de la votación. En el período 2023-2028 los estados presentes son `PUBLICADO` (llegó a ser ley), `ARCHIVADO` y `EN TRAMITE`. Un proyecto en trámite aparece solo si ya tuvo al menos una votación nominal. La ficha filtra el resumen y el historial por estado (parámetro `?estado=` en la dirección), con un resumen calculado aparte para cada estado. Las votaciones enlazadas a una ley sancionada del período llevan a la votación dentro de la ficha de la ley; las demás, al expediente oficial en SILpy (`proyecto.appURL`). Una votación sobre un proyecto `PUBLICADO` no tiene ficha de ley porque su ley no figura entre las sancionadas del período, y también enlaza a SILpy.

El sentido de un voto depende de lo que se vota en cada trámite (`tramitacion.descripcionEtapa` y `resultadoTramite`). Un `NO` puede rechazar el proyecto, pero también una modificación de la otra cámara o una objeción del Poder Ejecutivo, y en ese caso mantiene el proyecto. Por eso cada voto se muestra con su trámite y su resultado oficial, y no se calcula una cifra única de proyectos apoyados.

Las leyes de su autoría son las leyes sancionadas del período en cuyo proyecto figura entre los autores (`autores.json`, registros con `_propio.delPeriodo`).

Tienen ficha todos los legisladores del período, también los que ya no ejercen (`_propio.vigente = false`: no figuran en el listado de legisladores en ejercicio de la API). Su ficha lo indica.

## Ausencias en votaciones nominales

La API no publica listas de presencia en las sesiones ([auditoría](auditoria-datos.md), sección 7). Lo único disponible es la categoría `AUSENTE` de cada votación nominal, que indica que el legislador no registró su voto en ese momento, aunque pudiera estar en la sesión. Por eso la métrica se llama siempre **ausencias en votaciones nominales**, cuenta votaciones y no días, y nunca se presenta como asistencia, faltas o inasistencias.

Decisión de alcance (#29). La cifra de cada ficha es la cantidad de votaciones nominales del período en que el legislador figura como `AUSENTE` (`votos.csv`, `sentidoVotacion`), sobre **todas** las votaciones nominales en cuya lista oficial figura, de cualquier tipo de expediente (proyectos de ley, resoluciones, declaraciones, elección de autoridades y demás). Se eligió este total, y no solo el de proyectos de ley, porque lo que se mide es si estaba registrado para votar, sin importar qué se votaba. La lista de cada votación incluye solo a quienes ocupaban el cargo ese día (80 en Diputados y 45 en el Senado, salvo las votaciones con menos votos señaladas en las observaciones), así que el total equivale a las votaciones de su cámara mientras ejercía el cargo. Este total es mayor que el del resumen de votos, que cuenta solo proyectos de ley. Ejemplo del período 2023-2028, un diputado que ejerció todo el período figura en 865 votaciones nominales, 793 de ellas sobre proyectos de ley.

La ficha muestra la cantidad con su denominador y su porcentaje, por ejemplo "23 de 96 (24%)", y la lista de las votaciones en que figura como `AUSENTE`, de la más reciente a la más antigua, con la fecha (`tramitacion.fechaTramite`), el número y el tipo de sesión (`tramitacion.idSesion.numeroSesion` y `tipoSesion`) y el expediente (`proyecto.expedienteCamara`), con enlace a la votación oficial en SILpy (`appURL`). Los senadores vitalicios no figuran en las listas de votación, así que no tienen esta cifra.

El Senado publica muchas menos votaciones nominales que Diputados, así que las cifras de las dos cámaras no se comparan directamente. La API no informa si un legislador `AUSENTE` tenía permiso o licencia. La vista comparativa (sección siguiente) usa este mismo cálculo.

## NO VOTA y abstenciones en votaciones nominales

Decisión de alcance (#38). Además de las ausencias, la ficha muestra otras dos cifras con **el mismo denominador**, todas las votaciones nominales del período en cuya lista oficial figura, de cualquier tipo de expediente.

- **`NO VOTA`**. Votaciones en que figura con `sentidoVotacion` = `NO VOTA`, es decir, en la lista de la votación sin emitir voto. En el período 2023-2028 esta categoría aparece solo en el Senado.
- **`ABSTENCIÓN/BLANCO`**. Votaciones en que figura con `sentidoVotacion` = `ABSTENCIÓN/BLANCO`, un voto oficial de abstención o en blanco.

Las tres categorías (`AUSENTE`, `NO VOTA` y `ABSTENCIÓN/BLANCO`) significan cosas distintas, así que se muestran siempre por separado y nunca se suman en un índice de "participación". Cada cifra lleva su numerador, su denominador y su porcentaje con la fórmula

> cifra = votaciones en que figura con la categoría ÷ votaciones nominales en cuya lista figura × 100

Estas cifras usan un denominador distinto del resumen de votos de la ficha, que cuenta solo proyectos de ley, por eso pueden no coincidir con el `NO VOTA` y la `ABSTENCIÓN/BLANCO` de ese resumen.

**Vista comparativa** (`/legisladores/votaciones-nominales/`). Una tabla por cámara con los legisladores del período vigente que figuran en al menos una votación nominal, en ejercicio o no, con las tres cifras por separado. Por defecto se ordena por cámara y apellido, y se puede ordenar por cualquiera de las cifras, de mayor a menor porcentaje (parámetro `?orden=` con `ausencias`, `no-vota` o `abstencion`). Los títulos son neutrales y no hay posiciones, puestos ni calificativos. Las cámaras no se mezclan porque el Senado publica muchas menos votaciones nominales que Diputados.

**Descarga.** La misma tabla se publica en la página de datos abiertos, generada en cada compilación del sitio (`/datos/calculados/{período}/votaciones-nominales-por-legislador.csv` y `.json`), con las columnas `periodo`, `camara`, `slug`, `idLegislador`, `nombre`, `vigente`, `votacionesEnSuLista` (el denominador), `ausente`, `noVota` y `abstencionBlanco` (cantidades) y `porcentajeAusente`, `porcentajeNoVota` y `porcentajeAbstencionBlanco` (porcentaje con un decimal). Es un cálculo propio, no un dato oficial, y no se guarda en `datos/`.

## Números de ley

El número de ley se usa como URL (`/leyes/{número}/`). El importador verifica en cada ejecución que ningún número del período figure en otra legislatura, comparando con el listado histórico completo de la API. El resultado se informa en el resumen de cada ejecución.

## Limitaciones conocidas

- La API no informa cuándo se modificó un registro: los cambios se detectan comparando descargas.
- El partido y la bancada de un legislador son un único valor por período, sin fecha. Los votos no reflejan cambios de bancada.
- "AUSENTE" en una votación no equivale a ausencia en la sesión: la métrica se llama "ausencias en votaciones nominales".
