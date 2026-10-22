# Datos

Copia propia de los datos del Congreso Nacional, generada por el [importador](../importador/) a partir de la [API de Datos Abiertos Legislativos](https://datosv2.congreso.gov.py/web/api-doc/index.html).

**Origen de los datos: Datos Abiertos Poder Legislativo.** Licencia [CC BY 4.0](../LICENSE-DATOS.md). La fecha de la última actualización está en [`estado.json`](estado.json). Ante cualquier diferencia, prevalece la fuente oficial.

No editar estos archivos a mano, salvo las notas manuales de `propios/notas.json` y la unión de personas de `propios/personas.json` (ver abajo). El resto lo reescribe el importador.

## Archivos

| Archivo | Contenido |
|---|---|
| `periodos.json` | Períodos legislativos incluidos, con sus fechas y sus períodos parlamentarios anuales en la API. |
| `estado.json` | Última comprobación de la fuente, última vez que cambiaron los datos y cantidades por período. |
| `fuente/{período}/leyes.json` | Un registro por ley sancionada en el período, con su proyecto, ministerios y archivos adjuntos. |
| `fuente/{período}/tramitaciones.json` | Las tramitaciones del proyecto de cada ley (`idProyecto` + `tramitacion`). |
| `fuente/{período}/votaciones.json` | Votaciones nominales del período, sin los votos individuales. |
| `fuente/{período}/votos.csv` | Un voto individual por fila: `idVotacion`, `idDetalleVotacion`, `idLegislador`, `idSentidoVotacion`, `sentidoVotacion`, `observacion`. |
| `fuente/{período}/legisladores.json` | Legisladores del período, vigentes o no. |
| `fuente/{período}/autores.json` | Autores de cada proyecto con ley (`idProyecto` + `legislador`), en el orden que publica la API. |
| `propios/personas.json` | Identificador estable (slug) de cada persona y sus `idLegislador` por período. |
| `propios/notas.json` | Problemas detectados en la fuente: fechas mal formadas, totales que no coinciden, votos faltantes, etc. |

## Convenciones

- **Lo oficial y lo propio no se mezclan.** Todo valor fuera de una clave `_propio` es exactamente el que publica la API. Lo que agrega este proyecto va dentro de `_propio`, en el mismo objeto al que se refiere.
- **Fechas.** La API publica fechas como texto `dd/mm/aaaa`. Junto a cada campo de fecha, `_propio` tiene un campo del mismo nombre con la fecha en formato ISO (`aaaa-mm-dd`). Si el texto no es una fecha válida, la versión ISO es `null` y el problema queda en `propios/notas.json`; el texto original no se toca.
- **Identificadores.** Cada registro conserva su identificador oficial (`idLey`, `idProyecto`, `idVotacion`, `idLegislador`, `idTramitacion`) y su enlace a SILpy (`appURL`).
- **Orden fijo.** Los registros se ordenan por su identificador y las claves de cada objeto, alfabéticamente. Una descarga sin cambios en la fuente produce exactamente los mismos archivos.
- **Sin datos de contacto.** No se guardan el correo ni el teléfono de los legisladores.

## Campos propios

| Archivo | Campo en `_propio` | Significado |
|---|---|---|
| leyes | `numeroLey` | Número de ley sin espacios alrededor; agrupa los registros de una misma ley y forma su URL. |
| leyes | `periodoLegislativo`, `idPeriodoParlamentario` | Período en cuyo listado (`ley/periodo/{id}`) figura la ley. |
| leyes | `idVotaciones` | Votaciones nominales del período enlazadas con la ley: su proyecto coincide y su trámite figura entre las tramitaciones del proyecto. |
| leyes | `idVotacionesNoResueltas` | Votaciones del mismo proyecto cuyo trámite no figura en las tramitaciones publicadas. No se asume el enlace. |
| leyes | `idVotacionesOtrosPeriodos` | Votaciones del mismo proyecto que pertenecen a otra legislatura. |
| votaciones | `cantidadVotos`, `totalesRecalculados` | Votos individuales contados por sentido. |
| votaciones | `totalesCoinciden` | Si cada total publicado (`totalSI`, `totalNO`, `totalAbstencion`, `totalAusente`, `totalNoVota`) coincide con el recuento. |
| votaciones | `idLeyes`, `enlaceLey` | Leyes enlazadas y estado del enlace: `resuelto`, `no_resuelto` o `sin_ley` (el proyecto no tiene ley sancionada en el período). |
| legisladores | `vigente` | Si figura en el listado de legisladores en ejercicio (`legislador/camara/{S\|D}`). |
| legisladores | `slug` | Identificador estable de la persona (ver `propios/personas.json`). |
| legisladores | `fuenteRegistro` | De dónde se tomó el registro: el listado histórico, el de vigentes o, si no figura en ninguno, el voto que lo incluye. |
| autores | `orden`, `delPeriodo`, `slug` | Posición en la lista de autores, si el autor es legislador de este período y su slug, si lo tiene. |

## Edición manual

- **`propios/notas.json`**: se pueden agregar notas con `"origen": "manual"`. El importador reemplaza solo las notas con `"origen": "importador"` del período que importa.
- **`propios/personas.json`**: el importador asigna un slug a cada legislador nuevo y nunca cambia uno existente. Para unir a una misma persona entre legislaturas (Fase 5), se agrega su nuevo `idLegislador` a la entrada existente.
