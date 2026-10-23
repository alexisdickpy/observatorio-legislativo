"""Prueba de punta a punta del importador con una API simulada armada con ejemplos reales."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from importador.api import ErrorAPI
from importador.escribir import json_bytes
from importador.importar import DatosIncompletos, importar
from importador.pruebas.test_transformar import ejemplo

PERIODOS = {"periodos": [{"id": "2023-2028", "fechaInicio": "2023-07-01", "fechaFin": "2028-06-30",
                          "vigente": True, "periodosParlamentarios": []}]}


class ApiSimulada:
    def __init__(self, sin_leyes=False):
        self.consultas = 0
        ley = ejemplo("ley_periodo")
        votacion = ejemplo("votacion")
        tramitaciones = ejemplo("proyecto_tramitaciones")
        # La votación de ejemplo corresponde a este trámite del proyecto 150168.
        tramitaciones["tramitaciones"].append(copy.deepcopy(votacion["tramitacion"]))
        vigente = ejemplo("legislador_vigente")
        votantes = [v["legislador"] for v in votacion["votaciones"]]
        self.rutas = {
            "periodo": ejemplo("periodo"),
            "ley/periodo/100267": [] if sin_leyes else [ley],
            "proyecto/150168/tramitaciones": [tramitaciones],
            "proyecto/150168/adjuntos": [{"archivosAdjuntos": ejemplo("proyecto_adjuntos")}],
            "legislador?idCamara=A": [vigente] + votantes[:2],  # el tercer votante falta a propósito
            "legislador/camara/S": [vigente],
            "legislador/camara/D": votantes[:2],
            "ley": [ley],
            "votacion": [votacion],
        }

    def datos(self, ruta, params=None, reutilizable=False):
        if params:
            ruta += "?" + "&".join(f"{k}={v}" for k, v in params.items())
        return copy.deepcopy(self.rutas.get(ruta, []))

    def paginar(self, ruta, tam_pagina, reutilizable=False, clave=None):
        yield from self.datos(ruta)


def silencio(*_):
    pass


class Importar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.salida = Path(self.tmp.name)
        (self.salida / "periodos.json").write_bytes(json_bytes(PERIODOS))

    def tearDown(self):
        self.tmp.cleanup()

    def correr(self, api=None, ahora="2026-10-22T12:00:00Z"):
        return importar(api or ApiSimulada(), self.salida, ahora=ahora, progreso=silencio)

    def leer(self, ruta):
        return json.loads((self.salida / ruta).read_text(encoding="utf-8"))

    def foto(self):
        return {p.relative_to(self.salida): p.read_bytes() for p in sorted(self.salida.rglob("*")) if p.is_file()}

    def test_segunda_ejecucion_no_cambia_nada_ni_duplica(self):
        self.correr()
        antes = self.foto()
        resultado = self.correr(ahora="2026-10-23T12:00:00Z")
        despues = self.foto()
        self.assertEqual(resultado["cambiados"], [])
        # Solo cambian la fecha de comprobación y el registro de sincronizaciones.
        meta = {Path("estado.json"), Path("sincronizaciones.json")}
        self.assertEqual({k: v for k, v in antes.items() if k not in meta},
                         {k: v for k, v in despues.items() if k not in meta})
        self.assertEqual(len(self.leer("fuente/2023-2028/leyes.json")), 1)
        estado = self.leer("estado.json")
        self.assertEqual(estado["ultimaComprobacion"], "2026-10-23T12:00:00Z")
        self.assertEqual(estado["ultimaModificacion"], "2026-10-22T12:00:00Z")
        registro = self.leer("sincronizaciones.json")["sincronizaciones"]
        self.assertEqual([r["fecha"] for r in registro], ["2026-10-23T12:00:00Z", "2026-10-22T12:00:00Z"])
        self.assertEqual(registro[0]["cambios"]["leyes"], {"agregados": 0, "modificados": 0, "eliminados": 0})
        self.assertEqual(registro[0]["leyesNuevas"], [])
        self.assertEqual(registro[0]["archivosModificados"], [])

    def test_registro_detecta_leyes_nuevas_y_modificadas(self):
        self.correr()
        api = ApiSimulada()
        nueva = copy.deepcopy(api.rutas["ley/periodo/100267"][0])
        nueva.update(idLey=999999, numeroLey="9999", fechaSancion="20/10/2026")
        api.rutas["ley/periodo/100267"].append(nueva)
        api.rutas["ley/periodo/100267"][0]["observacionDecreto"] = "Corregido por la fuente"
        resultado = self.correr(api, ahora="2026-10-23T12:00:00Z")
        self.assertEqual(resultado["cambios"]["leyes"], {"agregados": [999999], "modificados": [146644], "eliminados": []})
        ultima = self.leer("sincronizaciones.json")["sincronizaciones"][0]
        self.assertEqual(ultima["resultado"], "correcta")
        self.assertEqual(ultima["leyesNuevas"], [{"idLey": 999999, "numeroLey": "9999", "fechaSancion": "2026-10-20"}])
        self.assertIn("fuente/2023-2028/leyes.json", ultima["archivosModificados"])

    def test_muchos_menos_registros_no_escribe_nada(self):
        self.correr()
        estado = self.leer("estado.json")
        estado["periodos"]["2023-2028"]["cantidades"]["votos"] = 1000  # la vez anterior había muchos más
        (self.salida / "estado.json").write_bytes(json_bytes(estado))
        antes = self.foto()
        with self.assertRaises(DatosIncompletos):
            self.correr(ahora="2026-10-23T12:00:00Z")
        self.assertEqual(self.foto(), antes)

    def test_permitir_disminucion(self):
        self.correr()
        estado = self.leer("estado.json")
        estado["periodos"]["2023-2028"]["cantidades"]["votos"] = 1000
        (self.salida / "estado.json").write_bytes(json_bytes(estado))
        resultado = importar(ApiSimulada(), self.salida, ahora="2026-10-23T12:00:00Z", progreso=silencio,
                             permitir_disminucion=True)
        self.assertTrue(any("votos: 1000 → 3" in a for a in resultado["avisos"]))
        self.assertEqual(self.leer("estado.json")["periodos"]["2023-2028"]["cantidades"]["votos"], 3)

    def test_archivos_y_enlaces(self):
        resultado = self.correr()
        carpeta = "fuente/2023-2028/"
        for tabla in ("leyes", "tramitaciones", "votaciones", "legisladores", "autores"):
            for extension in (".json", ".csv"):
                self.assertTrue((self.salida / carpeta / (tabla + extension)).exists(), tabla + extension)
        self.assertTrue((self.salida / carpeta / "votos.csv").exists())
        self.assertTrue((self.salida / "diccionario.md").exists())
        self.assertIn("fuente/2023-2028/leyes.csv", resultado["cambiados"])
        self.assertFalse([a for a in resultado["avisos"] if "sin describir" in a])
        ley = self.leer(carpeta + "leyes.json")[0]
        votacion = self.leer(carpeta + "votaciones.json")[0]
        self.assertEqual(ley["_propio"]["idVotaciones"], [108906])
        self.assertEqual(votacion["_propio"]["idLeyes"], [146644])
        self.assertEqual(votacion["_propio"]["enlaceLey"], "resuelto")
        self.assertEqual(resultado["cantidades"]["votos"], 3)

    def test_periodos_parlamentarios_se_completan_desde_la_api(self):
        resultado = self.correr()
        periodo = self.leer("periodos.json")["periodos"][0]
        self.assertEqual([p["idPeriodoParlamentario"] for p in periodo["periodosParlamentarios"]],
                         [100237, 100257, 100267])
        self.assertEqual(periodo["periodosParlamentarios"][-1]["fechaInicio"], "2026-07-01")
        self.assertEqual(len(resultado["avisos"]), 3)

    def test_votante_ausente_de_los_listados_se_incluye_y_se_anota(self):
        self.correr()
        legisladores = self.leer("fuente/2023-2028/legisladores.json")
        self.assertEqual(len(legisladores), 4)
        solo_votacion = [l for l in legisladores if l["_propio"]["fuenteRegistro"] == "votacion"]
        self.assertEqual(len(solo_votacion), 1)
        tipos = [n["tipo"] for n in self.leer("propios/notas.json")["notas"]]
        self.assertIn("legislador_solo_en_votaciones", tipos)

    def test_notas_manuales_y_slugs_existentes_se_conservan(self):
        manual = {"tipo": "aclaracion", "entidad": "ley", "id": 1, "detalle": "Nota escrita a mano.", "origen": "manual"}
        persona = {"slug": "mario-abdo", "nombre": "Mario Abdo",
                   "legisladores": [{"periodoLegislativo": "2023-2028", "idLegislador": 101534}]}
        (self.salida / "propios").mkdir()
        (self.salida / "propios" / "notas.json").write_bytes(json_bytes({"notas": [manual]}))
        (self.salida / "propios" / "personas.json").write_bytes(json_bytes({"personas": [persona]}))
        self.correr()
        self.correr()
        self.assertIn(manual, self.leer("propios/notas.json")["notas"])
        personas = self.leer("propios/personas.json")["personas"]
        self.assertIn(persona, personas)
        legislador = [l for l in self.leer("fuente/2023-2028/legisladores.json") if l["idLegislador"] == 101534][0]
        self.assertEqual(legislador["_propio"]["slug"], "mario-abdo")

    def test_sin_correos_ni_telefonos_en_ningun_archivo(self):
        api = ApiSimulada()
        api.rutas["legislador/camara/S"][0]["emailParlamentario"] = "secreto@senado.gov.py"
        api.rutas["legislador?idCamara=A"][0]["telefonoParlamentario"] = "000-0000"
        self.correr(api)
        for contenido in self.foto().values():
            self.assertNotIn(b"emailParlamentario", contenido)
            self.assertNotIn(b"telefonoParlamentario", contenido)

    def test_api_sin_leyes_no_escribe_nada(self):
        antes = self.foto()
        with self.assertRaises(ErrorAPI):
            self.correr(ApiSimulada(sin_leyes=True))
        self.assertEqual(self.foto(), antes)


if __name__ == "__main__":
    unittest.main()
