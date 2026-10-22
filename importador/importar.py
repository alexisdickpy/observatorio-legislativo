"""Importa un período legislativo desde la API del Congreso a datos/.

Uso (desde la raíz del repositorio):
    python -m importador                     # período vigente según datos/periodos.json
    python -m importador --periodo 2023-2028
    python -m importador --sin-red           # repite la importación con los crudos guardados

La descarga completa hace unas 1.200 consultas y tarda entre 10 y 20 minutos.
"""

import argparse
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from .api import BASE, Cliente, ErrorAPI
from .escribir import csv_bytes, escribir_si_cambia, json_bytes, leer_json
from .fechas import a_iso
from .personas import asignar
from .transformar import (
    COLUMNAS_VOTOS,
    PROPIO,
    Notas,
    filas_autores,
    filas_tramitaciones,
    numero_ley,
    periodo_parlamentario_de_votacion,
    transformar_legislador,
    transformar_ley,
    transformar_votacion,
    verificar_numeros_ley,
)

RAIZ = Path(__file__).resolve().parents[1]
FUENTE = {
    "nombre": "Datos Abiertos Poder Legislativo",
    "url": BASE,
    "licencia": "CC BY 4.0",
    "cita": "Origen de los datos: Datos Abiertos Poder Legislativo",
}


def elegir_periodo(periodos, id_periodo):
    if id_periodo:
        elegidos = [p for p in periodos if p["id"] == id_periodo]
    else:
        elegidos = [p for p in periodos if p.get("vigente")]
    if len(elegidos) != 1:
        raise ValueError(f"No se encontró un único período {'«' + id_periodo + '»' if id_periodo else 'vigente'} en periodos.json")
    return elegidos[0]


def actualizar_periodos_parlamentarios(periodo, cliente, avisos):
    """Completa la lista de períodos parlamentarios anuales con los que informa la API."""
    del_api = [p for p in cliente.datos("periodo") if p.get("periodoLegislativo") == periodo["id"]]
    if not del_api:
        raise ErrorAPI(f"La API no devolvió períodos parlamentarios para {periodo['id']}")
    conocidos = {p["idPeriodoParlamentario"] for p in periodo["periodosParlamentarios"]}
    for p in del_api:
        if p["idPeriodoParlamentario"] not in conocidos:
            periodo["periodosParlamentarios"].append({
                "idPeriodoParlamentario": p["idPeriodoParlamentario"],
                "periodoParlamentario": p["periodoParlamentario"],
                "fechaInicio": a_iso(p.get("fechaInicio"))[0],
                "fechaFin": a_iso(p.get("fechaTermino"))[0],
            })
            avisos.append(f"Nuevo período parlamentario agregado a periodos.json: {p['periodoParlamentario']}")
    ids_api = {p["idPeriodoParlamentario"] for p in del_api}
    for id_parl in sorted(conocidos - ids_api):
        avisos.append(f"El período parlamentario {id_parl} de periodos.json ya no figura en la API")
    periodo["periodosParlamentarios"].sort(key=lambda p: p["idPeriodoParlamentario"])
    return [p["idPeriodoParlamentario"] for p in periodo["periodosParlamentarios"]]


def clave_nota(n):
    return (n.get("periodoLegislativo") or "", n["entidad"], n["tipo"], str(n["id"]).zfill(12),
            n.get("ruta") or "", n["detalle"])


def importar(cliente, salida, id_periodo=None, ahora=None, progreso=print):
    salida = Path(salida)
    ahora = ahora or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    avisos = []
    notas = Notas()

    documento_periodos = leer_json(salida / "periodos.json")
    if documento_periodos is None:
        raise ValueError(f"No existe {salida / 'periodos.json'}")
    periodo = elegir_periodo(documento_periodos["periodos"], id_periodo)
    nombre = periodo["id"]
    inicio, fin = periodo["fechaInicio"], periodo["fechaFin"]
    progreso(f"Período legislativo {nombre} ({inicio} a {fin})")

    ids_parlamentarios = actualizar_periodos_parlamentarios(periodo, cliente, avisos)

    # --- Leyes del período --------------------------------------------------
    leyes_api = []
    vistas = set()
    for id_parl in ids_parlamentarios:
        for ley in cliente.datos(f"ley/periodo/{id_parl}"):
            if ley["idLey"] in vistas:
                avisos.append(f"La ley {ley['idLey']} figura en más de un período parlamentario")
                continue
            vistas.add(ley["idLey"])
            leyes_api.append((ley, id_parl))
    progreso(f"Leyes del período: {len(leyes_api)}")
    if not leyes_api:
        raise ErrorAPI("La API no devolvió ninguna ley del período")

    historico = list(cliente.paginar("ley", 500))
    progreso(f"Listado histórico de leyes: {len(historico)}")
    verificacion_numeros = verificar_numeros_ley([l for l, _ in leyes_api], historico, inicio, fin, notas)

    # --- Detalle de cada proyecto con ley ------------------------------------
    proyectos = sorted({l["proyecto"]["idProyecto"] for l, _ in leyes_api})
    detalle = {}
    for i, id_proyecto in enumerate(proyectos, 1):
        tramitaciones = cliente.datos(f"proyecto/{id_proyecto}/tramitaciones")
        adjuntos = cliente.datos(f"proyecto/{id_proyecto}/adjuntos")
        detalle[id_proyecto] = (tramitaciones[0] if tramitaciones else None, adjuntos[0] if adjuntos else None)
        if i % 100 == 0 or i == len(proyectos):
            progreso(f"  detalle de proyectos: {i}/{len(proyectos)}")

    # --- Legisladores ---------------------------------------------------------
    por_id = {}
    for legislador in cliente.datos("legislador", {"idCamara": "A"}):
        if legislador.get("periodoLegislativo") == nombre:
            por_id[legislador["idLegislador"]] = (legislador, "legislador?idCamara=A")
    ids_vigentes = set()
    if periodo.get("vigente"):
        for camara in ("S", "D"):
            for legislador in cliente.datos(f"legislador/camara/{camara}"):
                ids_vigentes.add(legislador["idLegislador"])
                if legislador["idLegislador"] not in por_id:
                    por_id[legislador["idLegislador"]] = (legislador, f"legislador/camara/{camara}")
                    avisos.append(f"Legislador vigente {legislador['idLegislador']} ausente del listado histórico")
    progreso(f"Legisladores del período: {len(por_id)} ({len(ids_vigentes)} vigentes)")

    # --- Votaciones (se procesan página por página) -----------------------------
    ids_parlamentarios_set = set(ids_parlamentarios)
    proyectos_con_ley = set(proyectos)
    votaciones, filas_votos, embebidos = [], [], {}
    fuera_del_periodo = defaultdict(list)
    total_votaciones_api = 0
    for votacion in cliente.paginar("votacion", 100):
        total_votaciones_api += 1
        if periodo_parlamentario_de_votacion(votacion) in ids_parlamentarios_set:
            registro, filas, legisladores = transformar_votacion(votacion, nombre, notas)
            votaciones.append(registro)
            filas_votos.extend(filas)
            for id_legislador, legislador in legisladores.items():
                embebidos.setdefault(id_legislador, legislador)
        else:
            id_proyecto = (votacion.get("proyecto") or {}).get("idProyecto")
            if id_proyecto in proyectos_con_ley:
                fuera_del_periodo[id_proyecto].append(votacion["idVotacion"])
    progreso(f"Votaciones: {len(votaciones)} del período, de {total_votaciones_api} en la API")
    if not votaciones:
        raise ErrorAPI("La API no devolvió ninguna votación del período")

    for id_legislador in sorted(set(embebidos) - set(por_id)):
        por_id[id_legislador] = (embebidos[id_legislador], "votacion")
        notas.agregar("legislador_solo_en_votaciones", "legislador", id_legislador,
                      "Vota en el período pero no figura en los listados de legisladores; "
                      "sus datos se toman del registro incluido en la votación.")

    # --- Personas y legisladores -----------------------------------------------
    ruta_personas = salida / "propios" / "personas.json"
    personas, slugs, slugs_nuevos = asignar(
        (leer_json(ruta_personas) or {"personas": []})["personas"],
        [l for l, _ in por_id.values()], nombre)
    legisladores = [
        transformar_legislador(l, id_legislador in ids_vigentes, slugs[id_legislador], fuente)
        for id_legislador, (l, fuente) in sorted(por_id.items())
    ]

    # --- Leyes y enlace con las votaciones -----------------------------------------
    votaciones.sort(key=lambda v: v["idVotacion"])
    votaciones_por_proyecto = defaultdict(list)
    for v in votaciones:
        id_proyecto = (v.get("proyecto") or {}).get("idProyecto")
        votaciones_por_proyecto[id_proyecto].append(v)

    leyes = []
    leyes_por_votacion = defaultdict(set)
    no_resueltas = set()
    for ley, id_parl in sorted(leyes_api, key=lambda x: x[0]["idLey"]):
        id_proyecto = ley["proyecto"]["idProyecto"]
        tramitaciones, adjuntos = detalle[id_proyecto]
        registro = transformar_ley(ley, nombre, id_parl, tramitaciones, adjuntos, notas)
        ids_tramitacion = {t["idTramitacion"] for t in (tramitaciones or {}).get("tramitaciones") or []}
        resueltas, sin_resolver = [], []
        for v in votaciones_por_proyecto.get(id_proyecto, []):
            id_tramitacion = (v.get("tramitacion") or {}).get("idTramitacion")
            if id_tramitacion in ids_tramitacion:
                resueltas.append(v["idVotacion"])
                leyes_por_votacion[v["idVotacion"]].add(ley["idLey"])
            else:
                sin_resolver.append(v["idVotacion"])
                no_resueltas.add(v["idVotacion"])
                notas.agregar("enlace_no_resuelto", "votacion", v["idVotacion"],
                              f"Es del proyecto {id_proyecto} (ley {numero_ley(ley.get('numeroLey'))}), pero su trámite "
                              f"{id_tramitacion} no figura entre las tramitaciones publicadas del proyecto.")
        registro[PROPIO].update({
            "idVotaciones": sorted(resueltas),
            "idVotacionesNoResueltas": sorted(sin_resolver),
            "idVotacionesOtrosPeriodos": sorted(fuera_del_periodo.get(id_proyecto, [])),
        })
        leyes.append(registro)

    for v in votaciones:
        id_leyes = sorted(leyes_por_votacion.get(v["idVotacion"], ()))
        if id_leyes:
            estado_enlace = "resuelto"
        elif v["idVotacion"] in no_resueltas:
            estado_enlace = "no_resuelto"
        else:
            estado_enlace = "sin_ley"
        v[PROPIO].update({"idLeyes": id_leyes, "enlaceLey": estado_enlace})

    # --- Tramitaciones y autores de cada proyecto ------------------------------------
    tramitaciones_salida, autores = [], []
    for id_proyecto in proyectos:
        tramitaciones = detalle[id_proyecto][0]
        if tramitaciones:
            tramitaciones_salida.extend(filas_tramitaciones(id_proyecto, tramitaciones.get("tramitaciones"), notas))
            autores.extend(filas_autores(id_proyecto, tramitaciones.get("autores"), nombre, slugs))

    # --- Notas: se reemplazan las del importador para este período y se conservan las demás
    ruta_notas = salida / "propios" / "notas.json"
    anteriores = (leer_json(ruta_notas) or {"notas": []})["notas"]
    conservadas = [n for n in anteriores if not (n.get("origen") == "importador" and n.get("periodoLegislativo") == nombre)]
    nuevas = [dict(n, origen="importador", periodoLegislativo=nombre) for n in notas.lista]
    todas_las_notas = sorted(conservadas + nuevas, key=clave_nota)

    # --- Escritura ---------------------------------------------------------------------
    filas_votos.sort(key=lambda f: (f["idVotacion"], f["idDetalleVotacion"] is None, f["idDetalleVotacion"] or 0))
    carpeta = salida / "fuente" / nombre
    archivos = {
        carpeta / "leyes.json": json_bytes(leyes),
        carpeta / "tramitaciones.json": json_bytes(tramitaciones_salida),
        carpeta / "votaciones.json": json_bytes(votaciones),
        carpeta / "votos.csv": csv_bytes(COLUMNAS_VOTOS, filas_votos),
        carpeta / "legisladores.json": json_bytes(legisladores),
        carpeta / "autores.json": json_bytes(autores),
        ruta_personas: json_bytes({"personas": personas}),
        ruta_notas: json_bytes({"notas": todas_las_notas}),
        salida / "periodos.json": json_bytes(documento_periodos),
    }
    cambiados = [ruta for ruta, contenido in archivos.items() if escribir_si_cambia(ruta, contenido)]

    cantidades = {
        "leyes": len(leyes),
        "numerosDeLey": len({l[PROPIO]["numeroLey"] for l in leyes}),
        "tramitaciones": len(tramitaciones_salida),
        "votaciones": len(votaciones),
        "votos": len(filas_votos),
        "legisladores": len(legisladores),
        "legisladoresVigentes": len(ids_vigentes),
        "autores": len(autores),
    }
    ruta_estado = salida / "estado.json"
    estado = leer_json(ruta_estado) or {}
    estado_periodo = estado.setdefault("periodos", {}).setdefault(nombre, {})
    # Sin red no se consultó la fuente: no cuenta como comprobación.
    if not getattr(cliente, "sin_red", False) or "ultimaComprobacion" not in estado_periodo:
        estado_periodo["ultimaComprobacion"] = ahora
    if cambiados or "ultimaModificacion" not in estado_periodo:
        estado_periodo["ultimaModificacion"] = ahora
    estado_periodo["cantidades"] = cantidades
    estado["ultimaComprobacion"] = max(p["ultimaComprobacion"] for p in estado["periodos"].values())
    estado["ultimaModificacion"] = max(p["ultimaModificacion"] for p in estado["periodos"].values())
    estado["fuente"] = FUENTE
    escribir_si_cambia(ruta_estado, json_bytes(estado))

    return {
        "periodo": nombre,
        "cantidades": cantidades,
        "enlaces": {
            "leyesConVotacion": sum(1 for l in leyes if l[PROPIO]["idVotaciones"]),
            "votacionesEnlazadasALey": sum(1 for v in votaciones if v[PROPIO]["enlaceLey"] == "resuelto"),
            "votacionesNoResueltas": len(no_resueltas),
        },
        "verificacionNumeros": verificacion_numeros,
        "notasPorTipo": dict(sorted(notas.por_tipo().items())),
        "slugsNuevos": len(slugs_nuevos),
        "avisos": avisos,
        "cambiados": [str(r.relative_to(salida)).replace("\\", "/") for r in cambiados],
        "consultas": cliente.consultas,
    }


def imprimir_resumen(r, segundos):
    print("\n=== Resumen de la importación ===")
    print(f"Período: {r['periodo']}")
    for clave, valor in r["cantidades"].items():
        print(f"  {clave}: {valor}")
    print("Enlaces ley-votación:")
    for clave, valor in r["enlaces"].items():
        print(f"  {clave}: {valor}")
    v = r["verificacionNumeros"]
    print(f"Números de ley: {v['numerosDelPeriodo']} del período, comparados con {v['registrosHistorico']} "
          f"registros históricos; repetidos en otros períodos: {v['conflictos']}; "
          f"leyes del período fuera de ley/periodo: {v['leyesDelPeriodoFueraDeListado']}")
    print("Notas sobre la fuente (datos/propios/notas.json):" if r["notasPorTipo"] else "Notas sobre la fuente: ninguna")
    for tipo, n in r["notasPorTipo"].items():
        print(f"  {tipo}: {n}")
    print(f"Personas nuevas con slug: {r['slugsNuevos']}")
    for aviso in r["avisos"]:
        print(f"AVISO: {aviso}")
    print("Archivos modificados:" if r["cambiados"] else "Archivos modificados: ninguno (la fuente no cambió)")
    for ruta in r["cambiados"]:
        print(f"  {ruta}")
    print(f"Consultas a la API: {r['consultas']} · duración: {segundos:.0f} s")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m importador", description=__doc__.splitlines()[0])
    parser.add_argument("--periodo", help="período legislativo de datos/periodos.json (por defecto, el vigente)")
    parser.add_argument("--salida", default=RAIZ / "datos", type=Path, help="carpeta de datos (por defecto datos/)")
    parser.add_argument("--crudo", default=RAIZ / "tmp" / "importador" / "crudo", type=Path,
                        help="carpeta de respuestas crudas de la API (por defecto tmp/importador/crudo/)")
    parser.add_argument("--sin-red", action="store_true", help="no consultar la API: leer las respuestas de --crudo")
    args = parser.parse_args(argv)

    inicio = time.monotonic()
    cliente = Cliente(args.crudo, sin_red=args.sin_red)
    try:
        resultado = importar(cliente, args.salida, args.periodo)
    except (ErrorAPI, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("No se modificó ningún archivo de datos.", file=sys.stderr)
        return 1
    imprimir_resumen(resultado, time.monotonic() - inicio)
    return 0
