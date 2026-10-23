# Datos

Copia propia de los datos del Congreso Nacional, generada por el [importador](../importador/) a partir de la [API de Datos Abiertos Legislativos](https://datosv2.congreso.gov.py/web/api-doc/index.html).

**Origen de los datos: Datos Abiertos Poder Legislativo.** Licencia [CC BY 4.0](../LICENSE-DATOS.md). La fecha de la última actualización está en [`estado.json`](estado.json). Ante cualquier diferencia, prevalece la fuente oficial.

Todos estos archivos son **datos abiertos**: se pueden descargar y reutilizar citando la fuente. El [diccionario de datos](diccionario.md) describe cada campo, su tipo y si es oficial o propio.

No editar estos archivos a mano, salvo las notas manuales de `propios/notas.json`, la unión de personas de `propios/personas.json` (ver abajo) y las descripciones de `diccionario.json`. El resto lo reescribe el importador.

## Archivos

| Archivo | Contenido |
|---|---|
| `periodos.json` | Períodos legislativos incluidos, con sus fechas y sus períodos parlamentarios anuales en la API. |
| `estado.json` | Última comprobación correcta de la fuente, última vez que cambiaron los datos y cantidades por período. Una sincronización fallida no lo modifica. |
| `diccionario.json`, `diccionario.md` | Diccionario de datos: cada campo de cada tabla, con su tipo, su origen (oficial o propio) y su descripción. El `.json` se edita a mano; el `.md` lo genera el importador, con la cita, la licencia y la fecha de actualización. |
| `sincronizaciones.json` | Registro de las últimas 90 sincronizaciones, de la más nueva a la más vieja: fecha, modo (`incremental` o `completo`), resultado (`correcta` o `error`), consultas, cantidades, leyes, votaciones y legisladores agregados, modificados y eliminados, leyes nuevas y archivos modificados. Las anteriores quedan en el historial de Git. |
| `fuente/{período}/leyes.json` y `.csv` | Un registro por ley sancionada en el período, con su proyecto, ministerios y archivos adjuntos. |
| `fuente/{período}/tramitaciones.json` y `.csv` | Las tramitaciones del proyecto de cada ley (`idProyecto` + `tramitacion`). |
| `fuente/{período}/votaciones.json` y `.csv` | Votaciones nominales del período, sin los votos individuales. |
| `fuente/{período}/votos.csv` | Un voto individual por fila: `idVotacion`, `idDetalleVotacion`, `idLegislador`, `idSentidoVotacion`, `sentidoVotacion`, `observacion`. |
| `fuente/{período}/legisladores.json` y `.csv` | Legisladores del período, vigentes o no. |
| `fuente/{período}/autores.json` y `.csv` | Autores de cada proyecto con ley (`idProyecto` + `legislador`), en el orden que publica la API. |
| `propios/personas.json` | Identificador estable (slug) de cada persona y sus `idLegislador` por período. |
| `propios/notas.json` | Problemas detectados en la fuente: fechas mal formadas, totales que no coinciden, votos faltantes, etc. |

## Convenciones

- **Lo oficial y lo propio no se mezclan.** Todo valor fuera de una clave `_propio` es exactamente el que publica la API. Lo que agrega este proyecto va dentro de `_propio`, en el mismo objeto al que se refiere.
- **Fechas.** La API publica fechas como texto `dd/mm/aaaa`. Junto a cada campo de fecha, `_propio` tiene un campo del mismo nombre con la fecha en formato ISO (`aaaa-mm-dd`). Si el texto no es una fecha válida, la versión ISO es `null` y el problema queda en `propios/notas.json`; el texto original no se toca.
- **Identificadores.** Cada registro conserva su identificador oficial (`idLey`, `idProyecto`, `idVotacion`, `idLegislador`, `idTramitacion`) y su enlace a SILpy (`appURL`).
- **Orden fijo.** Los registros se ordenan por su identificador y las claves de cada objeto, alfabéticamente. Una descarga sin cambios en la fuente produce exactamente los mismos archivos.
- **CSV.** Cada tabla JSON de `fuente/{período}/` tiene una versión CSV con el mismo contenido, para abrir en una planilla. La genera el importador en cada actualización a partir del JSON (también a mano: `python -m importador.abiertos`).
  - UTF-8 con BOM (así Excel reconoce los acentos), separado por comas, una fila por registro y la columna identificadora primero. En Excel, si las columnas no se separan solas: *Datos → Desde texto/CSV*.
  - Los objetos anidados se aplanan con puntos en el nombre de la columna (`proyecto.acapite`). Las listas de valores se unen con ` | `. Las listas de objetos (los archivos adjuntos de cada ley) quedan solo en el JSON.
  - Las columnas propias conservan `_propio` en el nombre (`_propio.fechaSancion`) y van después de las oficiales.
  - Verdadero y falso se escriben `true` y `false`; un valor nulo queda vacío.
- **Sin datos de contacto.** No se guardan el correo ni el teléfono de los legisladores.

## Campos propios

Todos los campos, oficiales y propios, están descritos en el [diccionario de datos](diccionario.md). Los criterios de los cálculos propios se documentan en la [metodología](../docs/metodologia.md).

## Edición manual

- **`diccionario.json`**: si la API agrega un campo, el importador lo avisa en su resumen (`AVISO: Campo sin describir…`). Se agrega su descripción y se regenera `diccionario.md` con `python -m importador.abiertos`.
- **`propios/notas.json`**: se pueden agregar notas con `"origen": "manual"`. El importador reemplaza solo las notas con `"origen": "importador"` del período que importa.
- **`propios/personas.json`**: el importador asigna un slug a cada legislador nuevo y nunca cambia uno existente. Para unir a una misma persona entre legislaturas (Fase 5), se agrega su nuevo `idLegislador` a la entrada existente.
