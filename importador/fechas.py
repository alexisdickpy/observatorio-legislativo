"""Conversión de las fechas de la API (texto dd/mm/aaaa) a ISO 8601 (aaaa-mm-dd).

Nunca se corrige una fecha por suposición: si el texto no es una fecha válida, la versión
ISO queda vacía (None) y se informa el problema para registrarlo como nota.
"""

import re
from datetime import date

ANIO_MINIMO = 1870  # Primera constitución del Paraguay independiente
ANIO_MAXIMO = 2100

_PATRON = re.compile(r"(\d{2})/(\d{2})/(\d{4})")


def a_iso(texto):
    """Devuelve (fecha ISO o None, descripción del problema o None).

    - Texto vacío o ausente: (None, None). No hay fecha, pero tampoco error.
    - Fecha válida: ("aaaa-mm-dd", None).
    - Cualquier otra cosa: (None, "motivo").
    """
    if texto is None or not str(texto).strip():
        return None, None
    m = _PATRON.fullmatch(str(texto).strip())
    if not m:
        return None, "formato no reconocido (se espera dd/mm/aaaa)"
    dia, mes, anio = map(int, m.groups())
    if not ANIO_MINIMO <= anio <= ANIO_MAXIMO:
        return None, f"año fuera de rango ({ANIO_MINIMO}-{ANIO_MAXIMO})"
    try:
        return date(anio, mes, dia).isoformat(), None
    except ValueError:
        return None, "fecha inexistente en el calendario"
