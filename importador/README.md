# Importador

Descarga los datos de un período legislativo desde la [API de Datos Abiertos Legislativos](https://datosv2.congreso.gov.py/web/api-doc/index.html) y escribe la copia propia en [`datos/`](../datos/). Python 3.10 o posterior, solo con la biblioteca estándar.

## Uso

Desde la raíz del repositorio:

```bash
python -m importador
```

- Importa el período marcado como vigente en `datos/periodos.json`. Otro período: `--periodo 2023-2028`.
- Hace unas 1.200 consultas a la API, con una pausa de 0,3 s entre ellas, y tarda entre 10 y 20 minutos.
- Guarda cada respuesta cruda en `tmp/importador/crudo/` (no se sube al repositorio).
- `--sin-red` repite la importación con esas respuestas guardadas, sin consultar la API.
- Al final imprime un resumen: cantidades, enlaces entre leyes y votaciones, notas sobre la fuente, avisos y archivos modificados.
- Si la API falla, termina con error y no modifica ningún archivo de datos.

Pruebas:

```bash
python -m unittest discover -s importador/pruebas -t .
```

## Qué descarga

| Consulta | Para qué |
|---|---|
| `periodo` | Períodos parlamentarios anuales del período legislativo |
| `ley/periodo/{id}` | Leyes sancionadas en cada período parlamentario |
| `ley` (paginado) | Histórico completo, para verificar que los números de ley no se repiten en otras legislaturas |
| `proyecto/{id}/tramitaciones` | Autores, ministerios y tramitaciones del proyecto de cada ley |
| `proyecto/{id}/adjuntos` | Archivos adjuntos (texto de la ley, iniciativa, sanción) |
| `legislador?idCamara=A` | Legisladores del período, vigentes o no |
| `legislador/camara/{S\|D}` | Legisladores en ejercicio |
| `votacion` (paginado) | Votaciones nominales con sus votos individuales |

No usa `votacion/parlamentario/{id}`, que devuelve siempre la misma votación (ver la [auditoría](../docs/auditoria-datos.md)).

## Archivos

| Archivo | Contenido |
|---|---|
| `importar.py` | Orquesta la importación y escribe el resumen |
| `api.py` | Cliente de la API: paginación, reintentos, respuestas 404 y guardado de crudos |
| `transformar.py` | Conversión de los registros de la API a los archivos de `datos/` |
| `fechas.py` | Fechas `dd/mm/aaaa` a ISO, sin corregir por suposición |
| `personas.py` | Slug estable de cada persona |
| `escribir.py` | Escritura determinista de JSON y CSV |
| `pruebas/` | Pruebas con ejemplos reales de la API |

Las convenciones de los archivos generados están en [`datos/README.md`](../datos/README.md) y las transformaciones, en la [metodología](../docs/metodologia.md).

La sincronización automática diaria y semanal es parte de #4.
