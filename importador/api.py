"""Cliente de la API de Datos Abiertos Legislativos (v2).

Cada respuesta se guarda cruda en una carpeta local (por defecto tmp/importador/crudo/,
que no se sube al repositorio). En modo sin red, el cliente lee de esa carpeta en lugar
de consultar la API: sirve para desarrollar y para repetir una importación exacta.

Los nombres de archivo siguen el mismo formato que la caché de la auditoría
(scripts/auditoria/api.py), así que esa caché también sirve como carpeta de crudos.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://datosv2.congreso.gov.py/web/api"
USER_AGENT = "observatorio-legislativo/importador (+https://github.com/alexisdickpy/observatorio-legislativo)"
PAUSA = 0.3  # segundos entre consultas, para no sobrecargar el servidor


class ErrorAPI(RuntimeError):
    """La API no respondió o respondió algo inesperado."""


def nombre_archivo(ruta, params=None):
    nombre = ruta.strip("/").replace("/", "_")
    if params:
        nombre += "__" + "_".join(f"{k}-{v}" for k, v in sorted(params.items()))
    return f"{nombre}.json"


class Cliente:
    def __init__(self, crudo, sin_red=False, pausa=PAUSA, reintentos=3):
        self.crudo = Path(crudo)
        self.sin_red = sin_red
        self.pausa = pausa
        self.reintentos = reintentos
        self.consultas = 0
        self._memoria = {}

    def obtener(self, ruta, params=None):
        """Devuelve el envoltorio completo ({codigoEstado, mensaje, datos}) de una ruta.

        Una respuesta 404 con cuerpo JSON ("Dato/s no encontrado/s") se devuelve como
        cualquier otra: `datos` vale None. Dentro de una misma ejecución, cada ruta se
        consulta una sola vez.
        """
        archivo = self.crudo / nombre_archivo(ruta, params)
        if archivo in self._memoria:
            return self._memoria[archivo]
        if self.sin_red:
            if not archivo.exists():
                raise ErrorAPI(f"Falta {archivo.name} en {self.crudo} (modo sin red)")
            cuerpo = archivo.read_bytes()
        else:
            cuerpo = self._descargar(ruta, params)
            self.crudo.mkdir(parents=True, exist_ok=True)
            archivo.write_bytes(cuerpo)
        respuesta = json.loads(cuerpo.decode("utf-8"))
        if respuesta.get("codigoEstado") not in (200, 404):
            raise ErrorAPI(f"{ruta}: codigoEstado inesperado {respuesta.get('codigoEstado')}")
        self._memoria[archivo] = respuesta
        return respuesta

    def datos(self, ruta, params=None):
        """Atajo: solo la lista `datos` (vacía si la API respondió 404)."""
        return self.obtener(ruta, params).get("datos") or []

    def paginar(self, ruta, tam_pagina):
        """Recorre un listado paginado. En esta API `offset` es el número de página (desde 1).

        Las páginas no se guardan en memoria entre llamadas: el listado de votaciones con
        sus votos pesa más de 100 MB.
        """
        pagina = 1
        while True:
            params = {"limit": tam_pagina, "offset": pagina}
            respuesta = self.obtener(ruta, params)
            self._memoria.pop(self.crudo / nombre_archivo(ruta, params), None)
            datos = respuesta.get("datos") or []
            yield from datos
            if len(datos) < tam_pagina:
                return
            pagina += 1

    def _descargar(self, ruta, params):
        url = f"{BASE}/{ruta.strip('/')}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        ultimo_error = None
        for intento in range(self.reintentos):
            try:
                peticion = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(peticion, timeout=300) as r:
                    cuerpo = r.read()
                break
            except urllib.error.HTTPError as e:
                # La API responde 404 con un cuerpo JSON válido cuando no hay datos.
                cuerpo = e.read()
                if e.code == 404 and cuerpo.strip().startswith(b"{"):
                    break
                ultimo_error = e
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                ultimo_error = e
            time.sleep(2 * (intento + 1))
        else:
            raise ErrorAPI(f"No se pudo obtener {url}: {ultimo_error}")
        self.consultas += 1
        time.sleep(self.pausa)
        return cuerpo
