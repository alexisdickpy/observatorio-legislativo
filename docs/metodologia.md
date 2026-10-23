# Metodología

Este documento reúne los criterios propios del proyecto. Se completa en el Issue #9; por ahora documenta lo que hace el importador.

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

La ficha de cada legislador resume sus votos en las votaciones nominales vinculadas a leyes sancionadas del período (`_propio.idLeyes` de cada votación) en cuya lista oficial figura (`votos.csv`). Cada categoría oficial se cuenta por separado, sin fusionar, y siempre con su denominador: "54 de 130 (41,5%)". La cantidad de AUSENTE se presenta como **ausencias en votaciones nominales**, no como ausencias a la sesión.

Las votaciones de proyectos que no llegaron a ser ley no se incluyen. Los senadores vitalicios no figuran en las listas de votación, así que su ficha no tiene votos.

Las leyes de su autoría son las leyes sancionadas del período en cuyo proyecto figura entre los autores (`autores.json`, registros con `_propio.delPeriodo`).

Tienen ficha todos los legisladores del período, también los que ya no ejercen (`_propio.vigente = false`: no figuran en el listado de legisladores en ejercicio de la API). Su ficha lo indica.

## Números de ley

El número de ley se usa como URL (`/leyes/{número}/`). El importador verifica en cada ejecución que ningún número del período figure en otra legislatura, comparando con el listado histórico completo de la API. El resultado se informa en el resumen de cada ejecución.

## Limitaciones conocidas

- La API no informa cuándo se modificó un registro: los cambios se detectan comparando descargas.
- El partido y la bancada de un legislador son un único valor por período, sin fecha. Los votos no reflejan cambios de bancada.
- "AUSENTE" en una votación no equivale a ausencia en la sesión: la métrica se llama "ausencias en votaciones nominales".
