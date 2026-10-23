"""Copia propia de las fotos oficiales de los legisladores."""

import tempfile
import unittest
from pathlib import Path

from importador.fotos import sincronizar, url_de_foto
from importador.importar import importar
from importador.pruebas.test_importar import PERIODOS, ApiSimulada, silencio
from importador.escribir import json_bytes

JPEG = b"\xff\xd8\xff\xe0 foto"
URL = "https://silpy.congreso.gov.py/images/{}.jpg"


def legislador(id_legislador, url=None):
    return {"idLegislador": id_legislador, "fotoURL": URL.format(id_legislador) if url is None else url}


class Descargas:
    def __init__(self, respuestas=None):
        self.pedidas = []
        self.respuestas = respuestas or {}

    def __call__(self, url):
        self.pedidas.append(url)
        respuesta = self.respuestas.get(url, JPEG)
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta


class Fotos(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.carpeta = Path(self.tmp.name) / "fotos" / "2023-2028"

    def tearDown(self):
        self.tmp.cleanup()

    def test_sin_foto_publicada(self):
        self.assertIsNone(url_de_foto({"fotoURL": "https://silpy.congreso.gov.py/images/noimage.jpg"}))
        self.assertIsNone(url_de_foto({"fotoURL": ""}))
        self.assertIsNone(url_de_foto({}))
        self.assertEqual(url_de_foto(legislador(101339)), URL.format(101339))

    def test_incremental_descarga_solo_las_que_faltan(self):
        sincronizar([legislador(1)], self.carpeta, Descargas(), completo=False)
        descargas = Descargas()
        cambiados, avisos = sincronizar([legislador(1), legislador(2)], self.carpeta, descargas, completo=False)
        self.assertEqual(descargas.pedidas, [URL.format(2)])
        self.assertEqual([p.name for p in cambiados], ["2.jpg"])
        self.assertEqual(avisos, [])
        self.assertEqual((self.carpeta / "2.jpg").read_bytes(), JPEG)

    def test_completo_reescribe_solo_las_que_cambiaron(self):
        sincronizar([legislador(1), legislador(2)], self.carpeta, Descargas(), completo=False)
        nueva = JPEG + b" nueva"
        descargas = Descargas({URL.format(2): nueva})
        cambiados, _ = sincronizar([legislador(1), legislador(2)], self.carpeta, descargas, completo=True)
        self.assertEqual(len(descargas.pedidas), 2)
        self.assertEqual([p.name for p in cambiados], ["2.jpg"])
        self.assertEqual((self.carpeta / "2.jpg").read_bytes(), nueva)

    def test_falla_o_respuesta_que_no_es_foto_conserva_la_copia_anterior(self):
        sincronizar([legislador(1), legislador(2)], self.carpeta, Descargas(), completo=False)
        descargas = Descargas({URL.format(1): OSError("sin conexión"), URL.format(2): b"<html>error</html>"})
        cambiados, avisos = sincronizar([legislador(1), legislador(2)], self.carpeta, descargas, completo=True)
        self.assertEqual(cambiados, [])
        self.assertEqual(len(avisos), 2)
        self.assertEqual((self.carpeta / "1.jpg").read_bytes(), JPEG)
        self.assertEqual((self.carpeta / "2.jpg").read_bytes(), JPEG)

    def test_se_borra_la_foto_que_ya_no_se_publica(self):
        sincronizar([legislador(1), legislador(2)], self.carpeta, Descargas(), completo=False)
        cambiados, _ = sincronizar([legislador(1), legislador(2, url=URL.format("noimage"))], self.carpeta,
                                   Descargas(), completo=False)
        self.assertEqual([p.name for p in cambiados], ["2.jpg"])
        self.assertFalse((self.carpeta / "2.jpg").exists())


class ApiConFotos(ApiSimulada):
    def __init__(self):
        super().__init__()
        self.archivos = []

    def archivo(self, url):
        self.archivos.append(url)
        return JPEG


class ImportarConFotos(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.salida = Path(self.tmp.name)
        (self.salida / "periodos.json").write_bytes(json_bytes(PERIODOS))

    def tearDown(self):
        self.tmp.cleanup()

    def test_la_importacion_guarda_las_fotos_y_las_registra(self):
        api = ApiConFotos()
        r = importar(api, self.salida, ahora="2026-10-22T12:00:00Z", progreso=silencio)
        fotos = sorted((self.salida / "fotos" / "2023-2028").glob("*.jpg"))
        self.assertTrue(fotos)
        self.assertEqual(len(fotos), len(api.archivos))
        self.assertTrue(all(f"fotos/2023-2028/{f.name}" in r["cambiados"] for f in fotos))

    def test_sin_red_no_descarga_fotos(self):
        api = ApiConFotos()
        api.sin_red = True
        importar(api, self.salida, ahora="2026-10-22T12:00:00Z", progreso=silencio)
        self.assertEqual(api.archivos, [])
        self.assertFalse((self.salida / "fotos").exists())


if __name__ == "__main__":
    unittest.main()
