"""Serialización determinista: los mismos datos producen exactamente los mismos bytes.

- JSON en UTF-8, con claves ordenadas, sangría de 2 espacios y salto de línea final.
- CSV en UTF-8, con saltos de línea \\n y columnas fijas.
- Un archivo solo se reescribe si su contenido cambió.
"""

import csv
import io
import json
import os
from pathlib import Path


def json_bytes(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def csv_bytes(columnas, filas):
    salida = io.StringIO()
    escritor = csv.DictWriter(salida, fieldnames=columnas, lineterminator="\n", extrasaction="raise")
    escritor.writeheader()
    for fila in filas:
        escritor.writerow({c: "" if fila.get(c) is None else fila[c] for c in columnas})
    return salida.getvalue().encode("utf-8")


def leer_json(ruta, por_defecto=None):
    ruta = Path(ruta)
    if not ruta.exists():
        return por_defecto
    return json.loads(ruta.read_bytes().decode("utf-8"))


def escribir_si_cambia(ruta, contenido):
    """Escribe `contenido` (bytes) en `ruta` solo si es distinto. Devuelve True si escribió."""
    ruta = Path(ruta)
    if ruta.exists() and ruta.read_bytes() == contenido:
        return False
    ruta.parent.mkdir(parents=True, exist_ok=True)
    temporal = ruta.with_name(ruta.name + ".tmp")
    temporal.write_bytes(contenido)
    os.replace(temporal, ruta)
    return True
