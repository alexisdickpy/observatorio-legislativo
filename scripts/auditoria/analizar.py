"""Calcula las cifras de cobertura y calidad de datos del período 2023-2028.

Uso (desde la raíz del repositorio, después de descargar.py):
    python scripts/auditoria/analizar.py

Escribe:
    docs/auditoria/cifras.json   cifras usadas en docs/auditoria-datos.md
    docs/auditoria/ejemplos/     respuestas reales recortadas, sin datos de contacto

No consulta la API: trabaja solo con la caché que deja descargar.py.
"""

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from api import CACHE, RAIZ, obtener

PERIODO_LEGISLATIVO = "2023-2028"
INICIO_PERIODO = date(2023, 7, 1)
MIEMBROS = {"CAMARA DE SENADORES": 45, "CAMARA DE DIPUTADOS": 80}
SALIDA = RAIZ / "docs" / "auditoria"
CAMPOS_CONTACTO = {"emailParlamentario", "telefonoParlamentario", "curriculum", "email"}


def fecha(texto):
    """Convierte dd/mm/aaaa en date. Devuelve None si falta o si el año es inverosímil."""
    if not texto:
        return None
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", texto.strip())
    if not m:
        return None
    d, mes, a = map(int, m.groups())
    if a < 1870 or a > 2100:
        return None
    try:
        return date(a, mes, d)
    except ValueError:
        return None


def sin_contacto(obj):
    if isinstance(obj, dict):
        return {k: sin_contacto(v) for k, v in obj.items() if k not in CAMPOS_CONTACTO}
    if isinstance(obj, list):
        return [sin_contacto(x) for x in obj]
    return obj


def recortar(obj, max_lista=3):
    if isinstance(obj, dict):
        return {k: recortar(v, max_lista) for k, v in obj.items()}
    if isinstance(obj, list):
        return [recortar(x, max_lista) for x in obj[:max_lista]]
    return obj


def listado_cacheado(prefijo):
    """Lee todas las páginas cacheadas de un listado, en orden de página."""
    paginas = []
    for archivo in CACHE.glob(f"{prefijo}__limit-*_offset-*.json"):
        n = int(re.search(r"offset-(\d+)", archivo.name).group(1))
        paginas.append((n, json.loads(archivo.read_bytes().decode("utf-8")).get("datos") or []))
    return [x for _, datos in sorted(paginas) for x in datos]


def clasificar_votacion(v):
    """Etapa de una votación según la subetapa del trámite, la descripción y la observación.

    Senadores suele escribir la etapa en `descripcion`; Diputados, en `observacion`
    (p. ej. "(Si) Aprobación en general (No) Rechazo").
    """
    sub = ((v.get("tramitacion") or {}).get("descripcionSubEtapa") or "").upper()
    texto = f"{v.get('descripcion') or ''} {v.get('observacion') or ''}".upper()
    if "OBJECI" in sub or "OBJECI" in texto:
        return "objeción del Ejecutivo"
    if "(3T)" in sub or "(4T)" in sub:
        return "3.º/4.º trámite (modificaciones o ratificación)"
    if "RATIFICA" in texto:
        return "3.º/4.º trámite (modificaciones o ratificación)"
    if "EN GENERAL Y EN PARTICULAR" in texto:
        return "en general y en particular"
    if "EN GENERAL" in texto:
        return "en general"
    if "EN PARTICULAR" in texto or re.search(r"\bART[IÍ]CULOS?\b", texto):
        return "en particular"
    return "sin etapa explícita"


def es_aprobacion_global(v):
    """Votación que decide si se aprueba el proyecto en su conjunto en esa cámara."""
    return clasificar_votacion(v) in ("en general", "en general y en particular")


def main():
    cifras = {}
    problemas = defaultdict(list)

    # --- Períodos ---------------------------------------------------------
    periodos = [p for p in obtener("periodo")["datos"] if p["periodoLegislativo"] == PERIODO_LEGISLATIVO]
    ids_periodos = [p["idPeriodoParlamentario"] for p in periodos]

    # --- Leyes ------------------------------------------------------------
    leyes = []
    por_periodo = {}
    for p in periodos:
        datos = obtener(f"ley/periodo/{p['idPeriodoParlamentario']}")["datos"] or []
        por_periodo[p["periodoParlamentario"]] = len(datos)
        leyes.extend(datos)
    todas = listado_cacheado("ley")
    ids_periodo = {l["idLey"] for l in leyes}
    con_fecha_en_periodo = [l for l in todas if (fecha(l["fechaSancion"]) or date.min) >= INICIO_PERIODO]
    faltan_en_periodo = [l for l in con_fecha_en_periodo if l["idLey"] not in ids_periodo]
    fechas_malas_global = [l for l in todas if l.get("fechaSancion") and not fecha(l["fechaSancion"])]
    numeros = Counter(l["numeroLey"] for l in leyes)

    campos_vacios = Counter()
    for l in leyes:
        for campo in ("fechaSancion", "fechaPromulgacion", "fechaPublicacion", "numeroLey"):
            if not l.get(campo):
                campos_vacios[campo] += 1
            elif campo.startswith("fecha") and not fecha(l[campo]):
                campos_vacios[campo + " (mal formada)"] += 1
                problemas["fecha_mal_formada_periodo"].append({"idLey": l["idLey"], "numeroLey": l["numeroLey"], campo: l[campo]})

    for numero in [n for n, c in numeros.items() if c > 1][:3]:
        problemas["numero_de_ley_con_varios_registros"].append(
            [{"idLey": l["idLey"], "numeroLey": l["numeroLey"], "idProyecto": l["proyecto"]["idProyecto"],
              "expedienteCamara": l["proyecto"]["expedienteCamara"]} for l in leyes if l["numeroLey"] == numero])
    for l in fechas_malas_global[:10]:
        problemas["fecha_sancion_mal_formada_historico"].append(
            {"idLey": l["idLey"], "numeroLey": l["numeroLey"], "fechaSancion": l["fechaSancion"]})
    for l in faltan_en_periodo[:10]:
        problemas["ley_con_fecha_en_periodo_no_listada_por_periodo"].append(
            {"idLey": l["idLey"], "numeroLey": l["numeroLey"], "fechaSancion": l["fechaSancion"]})

    acapites = [l["proyecto"].get("acapite") or "" for l in leyes]
    cifras["leyes"] = {
        "total_periodo": len(leyes),
        "por_periodo_parlamentario": por_periodo,
        "fecha_sancion_min": min(fecha(l["fechaSancion"]) for l in leyes if fecha(l["fechaSancion"])).isoformat(),
        "fecha_sancion_max": max(fecha(l["fechaSancion"]) for l in leyes if fecha(l["fechaSancion"])).isoformat(),
        "numeros_de_ley_distintos": len(numeros),
        "total_historico_api": len(todas),
        "historico_con_fecha_sancion_mal_formada": len(fechas_malas_global),
        "con_fecha_sancion_en_periodo_segun_listado_general": len(con_fecha_en_periodo),
        "con_fecha_en_periodo_pero_ausentes_de_ley_periodo": len(faltan_en_periodo),
        "numeros_de_ley_repetidos": {k: v for k, v in numeros.items() if v > 1},
        "campos_vacios_o_mal_formados": dict(campos_vacios),
        "iniciativa": dict(Counter(l["proyecto"].get("iniciativa") for l in leyes)),
        "origen": dict(Counter(l["proyecto"].get("origenProyecto") for l in leyes)),
        "tipo_promulgacion": dict(Counter(l.get("tipoPromulgacion") for l in leyes)),
        "tipo_proyecto": dict(Counter(l["proyecto"].get("tipoProyecto") for l in leyes)),
        "acapite_longitud": {
            "min": min(map(len, acapites)), "max": max(map(len, acapites)),
            "mediana": sorted(map(len, acapites))[len(acapites) // 2],
            "mas_de_300_caracteres": sum(len(a) > 300 for a in acapites),
            "incluye_presentado_por": sum("presentado por" in a.lower() for a in acapites),
            "empieza_con_proyecto_de_ley": sum(a.lower().lstrip(' "“').startswith("proyecto de ley") for a in acapites),
        },
        "ids_ley_ordenados_igual_que_fecha_sancion": None,
    }
    ordenadas = sorted((l for l in leyes if fecha(l["fechaSancion"])), key=lambda l: l["idLey"])
    inversiones = sum(1 for a, b in zip(ordenadas, ordenadas[1:]) if fecha(a["fechaSancion"]) > fecha(b["fechaSancion"]))
    cifras["leyes"]["ids_ley_ordenados_igual_que_fecha_sancion"] = {
        "pares_consecutivos": len(ordenadas) - 1, "inversiones": inversiones}

    # --- Proyectos de esas leyes: autores, tramitaciones, adjuntos -----------
    proyectos = {}
    adjuntos = {}
    for l in leyes:
        idp = l["proyecto"]["idProyecto"]
        r = obtener(f"proyecto/{idp}/tramitaciones")
        proyectos[idp] = (r.get("datos") or [{}])[0]
        r = obtener(f"proyecto/{idp}/adjuntos")
        adjuntos[idp] = ((r.get("datos") or [{}])[0]).get("archivosAdjuntos") or []

    # --- Legisladores ----------------------------------------------------
    vigentes = {}
    for camara in ("S", "D"):
        for leg in obtener(f"legislador/camara/{camara}")["datos"] or []:
            vigentes[leg["idLegislador"]] = leg
    todos_leg = obtener("legislador", {"idCamara": "A"})["datos"] or []
    ids_todos_leg = {x["idLegislador"] for x in todos_leg}

    def contar(campo):
        return dict(Counter((v.get(campo) or "(vacío)") for v in vigentes.values()).most_common())

    cifras["legisladores_vigentes"] = {
        "total": len(vigentes),
        "por_camara": contar("camaraParlamentario"),
        "por_camara_y_tipo": dict(Counter(f"{v.get('camaraParlamentario')} / {v.get('tipoParlamentario')}" for v in vigentes.values())),
        "periodo_legislativo": contar("periodoLegislativo"),
        "activo": dict(Counter(str(v.get("activo")) for v in vigentes.values())),
        "partido": contar("partidoPolitico"),
        "bancada": contar("bancada"),
        "sin_departamento": sum(not v.get("departamento") for v in vigentes.values()),
        "sin_bancada": sum(not v.get("bancada") for v in vigentes.values()),
        "sin_foto": sum(not v.get("fotoURL") for v in vigentes.values()),
        "listado_historico_total": len(todos_leg),
        "listado_historico_por_periodo": dict(Counter(x.get("periodoLegislativo") for x in todos_leg)),
        "campos": sorted(next(iter(vigentes.values())).keys()) if vigentes else [],
    }

    # Autores
    sin_autores = []
    autores_total = 0
    autores_vigentes = 0
    autores_fuera_listado = 0
    autores_periodo_previo = 0
    con_ministerios = 0
    for l in leyes:
        p = proyectos[l["proyecto"]["idProyecto"]]
        autores = p.get("autores") or []
        autores_total += len(autores)
        autores_vigentes += sum(a["idLegislador"] in vigentes for a in autores)
        autores_fuera_listado += sum(a["idLegislador"] not in ids_todos_leg for a in autores)
        autores_periodo_previo += sum(a.get("periodoLegislativo") != PERIODO_LEGISLATIVO for a in autores)
        con_ministerios += bool(p.get("ministerios"))
        if not autores and p.get("iniciativa") == "PARLAMENTARIA":
            sin_autores.append({"idLey": l["idLey"], "numeroLey": l["numeroLey"], "idProyecto": p.get("idProyecto")})
    leyes_parlamentarias = [l for l in leyes if l["proyecto"].get("iniciativa") == "PARLAMENTARIA"]
    leyes_ejecutivo = [l for l in leyes if l["proyecto"].get("iniciativa") == "PODER EJECUTIVO"]
    ejemplo_ministerios = next((proyectos[l["proyecto"]["idProyecto"]].get("ministerios") for l in leyes_ejecutivo
                                if proyectos[l["proyecto"]["idProyecto"]].get("ministerios")), None)
    cifras["autores"] = {
        "leyes_iniciativa_parlamentaria": len(leyes_parlamentarias),
        "leyes_parlamentarias_sin_autores": len(sin_autores),
        "registros_de_autoria": autores_total,
        "autores_distintos": len({a["idLegislador"] for p in proyectos.values() for a in (p.get("autores") or [])}),
        "registros_de_autor_legislador_vigente": autores_vigentes,
        "registros_de_autor_de_periodo_anterior": autores_periodo_previo,
        "registros_de_autor_fuera_del_listado_de_legisladores": autores_fuera_listado,
        "leyes_iniciativa_ejecutivo": len(leyes_ejecutivo),
        "leyes_con_ministerios": con_ministerios,
        "ejemplo_ministerios": ejemplo_ministerios,
        "leyes_ejecutivo_con_autores_legisladores": sum(bool(proyectos[l["proyecto"]["idProyecto"]].get("autores")) for l in leyes_ejecutivo),
    }
    problemas["ley_parlamentaria_sin_autores"] = sin_autores[:10]

    # Adjuntos
    tipos_adj = Counter()
    leyes_con_texto_ley = 0
    for l in leyes:
        adj = adjuntos[l["proyecto"]["idProyecto"]]
        tipos_adj.update(f"{a.get('infoAdjunto')} ({a.get('tipoArchivo')})" for a in adj)
        leyes_con_texto_ley += any(a.get("tipoAdjunto") == "LEY" for a in adj)
    cifras["adjuntos"] = {
        "leyes_con_pdf_de_la_ley": leyes_con_texto_ley,
        "leyes_sin_adjuntos": sum(not adjuntos[l["proyecto"]["idProyecto"]] for l in leyes),
        "tipos": dict(tipos_adj.most_common(25)),
    }

    # --- Votaciones ------------------------------------------------------
    votaciones = listado_cacheado("votacion")
    ids_vot = {v["idVotacion"] for v in votaciones}

    def periodo_votacion(v):
        ses = (v.get("tramitacion") or {}).get("idSesion") or {}
        return (ses.get("periodoParlamentarioDTO") or {}).get("periodoLegislativo")

    def camara(v):
        return (v.get("tramitacion") or {}).get("camaraTramite")

    del_periodo = [v for v in votaciones if periodo_votacion(v) == PERIODO_LEGISLATIVO]
    anios = Counter()
    for v in votaciones:
        f = fecha((v.get("tramitacion") or {}).get("fechaTramite"))
        anios[f.year if f else "sin fecha"] += 1

    sentidos = Counter()
    sentidos_camara = defaultdict(Counter)
    pares_sentido = Counter()
    descuadres_totales = []
    menos_registros = []
    duplicados = []
    sin_legislador = 0
    votos_periodo = 0
    vot_por_proyecto = defaultdict(list)
    for v in votaciones:
        detalle = v.get("votaciones") or []
        if (v.get("proyecto") or {}).get("idProyecto"):
            vot_por_proyecto[v["proyecto"]["idProyecto"]].append(v)
        if periodo_votacion(v) != PERIODO_LEGISLATIVO:
            continue
        votos_periodo += len(detalle)
        cuenta = Counter()
        for d in detalle:
            s = d.get("sentidoVotacion")
            sentidos[s] += 1
            sentidos_camara[camara(v)][s] += 1
            pares_sentido[f"{d.get('idSentidoVotacion')} = {s}"] += 1
            cuenta[s] += 1
            if not (d.get("legislador") or {}).get("idLegislador"):
                sin_legislador += 1
        ids_leg = [(d.get("legislador") or {}).get("idLegislador") for d in detalle]
        if len(ids_leg) != len(set(ids_leg)):
            duplicados.append(v["idVotacion"])
        suma_totales = sum(v.get(k) or 0 for k in ("totalSI", "totalNO", "totalAbstencion", "totalAusente", "totalNoVota"))
        if suma_totales != len(detalle):
            descuadres_totales.append({"idVotacion": v["idVotacion"], "suma_totales": suma_totales, "registros": len(detalle)})
        esperado = MIEMBROS.get(camara(v))
        if esperado and len(detalle) < esperado:
            menos_registros.append({"idVotacion": v["idVotacion"], "camara": camara(v), "registros": len(detalle), "miembros": esperado})

    clases = Counter((camara(v), clasificar_votacion(v)) for v in del_periodo)
    registros_por_votacion = Counter(len(v.get("votaciones") or []) for v in del_periodo)

    # Comprobación de completitud con las votaciones por legislador
    ids_por_legislador = set()
    for id_leg in vigentes:
        for d in obtener(f"votacion/parlamentario/{id_leg}").get("datos") or []:
            idv = d.get("idVotacion") or (d.get("votacion") or {}).get("idVotacion")
            if idv:
                ids_por_legislador.add(idv)
    ejemplo_por_legislador = next((obtener(f"votacion/parlamentario/{i}").get("datos") for i in vigentes
                                   if obtener(f"votacion/parlamentario/{i}").get("datos")), None)

    cifras["votaciones"] = {
        "total_api": len(votaciones),
        "por_anio_de_tramite": {str(k): v for k, v in sorted(anios.items(), key=lambda x: str(x[0]))},
        "del_periodo_2023_2028": len(del_periodo),
        "del_periodo_por_camara": dict(Counter(camara(v) for v in del_periodo)),
        "del_periodo_por_tipo_proyecto": dict(Counter((v.get("proyecto") or {}).get("tipoProyecto") for v in del_periodo).most_common(10)),
        "del_periodo_por_clase_de_votacion": {f"{c} / {k}": n for (c, k), n in sorted(clases.items(), key=str)},
        "registros_por_votacion_frecuencia": dict(sorted(registros_por_votacion.items())),
        "votos_individuales_del_periodo": votos_periodo,
        "sentidos": dict(sentidos),
        "sentidos_por_camara_pct": {c: {k: round(100 * n / sum(cnt.values()), 1) for k, n in cnt.most_common()}
                                    for c, cnt in sentidos_camara.items()},
        "pares_id_sentido": dict(pares_sentido),
        "votos_sin_legislador": sin_legislador,
        "votaciones_con_legislador_repetido": len(duplicados),
        "votaciones_donde_totales_no_cuadran_con_registros": len(descuadres_totales),
        "votaciones_con_menos_registros_que_miembros": len(menos_registros),
        "votacion_por_legislador_registros_por_respuesta": dict(Counter(
            len(obtener(f"votacion/parlamentario/{i}").get("datos") or []) for i in vigentes)),
        "ids_vistos_en_votaciones_por_legislador": len(ids_por_legislador),
        "ids_por_legislador_ausentes_del_listado_general": len(ids_por_legislador - ids_vot),
    }
    problemas["totales_no_cuadran"] = descuadres_totales[:10]
    problemas["menos_registros_que_miembros"] = menos_registros[:10]

    # --- Enlace leyes <-> votaciones --------------------------------------
    enlace = Counter()
    general_por_camara = Counter()
    leyes_sin_votacion = []
    vot_ley_periodo = 0
    votaciones_ley_fuera_tramitaciones = 0
    for l in leyes:
        idp = l["proyecto"]["idProyecto"]
        vs = vot_por_proyecto.get(idp, [])
        ids_tram = {t.get("idTramitacion") for t in (proyectos[idp].get("tramitaciones") or [])}
        votaciones_ley_fuera_tramitaciones += sum((v.get("tramitacion") or {}).get("idTramitacion") not in ids_tram for v in vs)
        if not vs:
            leyes_sin_votacion.append(l)
            continue
        enlace["con_al_menos_una_votacion"] += 1
        camaras = {camara(v) for v in vs}
        for c in camaras:
            enlace[f"con_alguna_votacion_en_{c}"] += 1
        enlace["votaciones_previas_al_periodo"] += sum(periodo_votacion(v) != PERIODO_LEGISLATIVO for v in vs)
        enlace[f"con_votacion_en_{len(camaras)}_camara(s)"] += 1
        if any(periodo_votacion(v) == PERIODO_LEGISLATIVO for v in vs):
            enlace["con_votacion_dentro_del_periodo"] += 1
        vot_ley_periodo += len(vs)
        for c in camaras:
            if any(camara(v) == c and es_aprobacion_global(v) for v in vs):
                general_por_camara[c] += 1
        if all(any(camara(v) == c and es_aprobacion_global(v) for v in vs) for c in MIEMBROS):
            enlace["con_votacion_en_general_en_ambas_camaras"] += 1
    # Una misma ley puede figurar con varios proyectos (proyectos acumulados): agrupar por número
    numeros_con_votacion = {l["numeroLey"] for l in leyes if vot_por_proyecto.get(l["proyecto"]["idProyecto"])}
    enlace["numeros_de_ley_con_al_menos_una_votacion"] = len(numeros_con_votacion)
    enlace["numeros_de_ley_sin_votacion"] = len(numeros) - len(numeros_con_votacion)
    # Plenarios con resultado registrado en tramitaciones (para ver qué fracción se votó nominalmente)
    plenarios = Counter()
    for l in leyes:
        for t in proyectos[l["proyecto"]["idProyecto"]].get("tramitaciones") or []:
            if "Plenario" in (t.get("descripcionSubEtapa") or ""):
                plenarios[t.get("camaraTramite")] += 1
    cifras["leyes_y_votaciones"] = {
        **enlace,
        "sin_ninguna_votacion_nominal": len(leyes_sin_votacion),
        "votaciones_enlazadas_a_leyes_del_periodo": vot_ley_periodo,
        "con_votacion_en_general_por_camara": dict(general_por_camara),
        "tramites_de_plenario_en_esas_leyes_por_camara": dict(plenarios),
        "votaciones_cuyo_idTramitacion_no_figura_en_el_proyecto": votaciones_ley_fuera_tramitaciones,
        "sin_votacion_por_iniciativa": dict(Counter(l["proyecto"].get("iniciativa") for l in leyes_sin_votacion)),
    }

    # --- Test de afinidad: votaciones elegibles ---------------------------
    elegibles = Counter()
    for v in del_periodo:
        si, no = v.get("totalSI") or 0, v.get("totalNO") or 0
        if (v.get("proyecto") or {}).get("tipoProyecto") == "PROYECTO DE LEY" and si + no and min(si, no) / (si + no) >= 0.10:
            elegibles[f"{camara(v)} / cualquier votación de proyecto de ley y minoría >= 10%"] += 1
        if not es_aprobacion_global(v):
            continue
        si, no = v.get("totalSI") or 0, v.get("totalNO") or 0
        if si + no == 0:
            continue
        minoria = min(si, no) / (si + no)
        if minoria >= 0.10:
            elegibles[f"{camara(v)} / minoría >= 10%"] += 1
        if minoria >= 0.25:
            elegibles[f"{camara(v)} / minoría >= 25%"] += 1
        if (v.get("proyecto") or {}).get("tipoProyecto") == "PROYECTO DE LEY" and minoria >= 0.10:
            elegibles[f"{camara(v)} / proyecto de ley y minoría >= 10%"] += 1
    cifras["test_afinidad"] = dict(sorted(elegibles.items()))

    # --- Sesiones (asistencia) ------------------------------------------
    sesiones = Counter()
    hora_invertida = []
    for p in periodos:
        for c in ("S", "D"):
            for s in obtener(f"sesion/periodo/{p['idPeriodoParlamentario']}", {"idCamara": c}).get("datos") or []:
                sesiones[f"{p['periodoParlamentario']} / {s.get('camaraSesion')}"] += 1
                if s.get("horaInicio") and s.get("horaFin") and s["horaFin"] < s["horaInicio"]:
                    hora_invertida.append({"idSesion": s["idSesion"], "horaInicio": s["horaInicio"], "horaFin": s["horaFin"]})
    cifras["sesiones"] = {"por_periodo_y_camara": dict(sorted(sesiones.items())),
                          "con_hora_fin_anterior_a_inicio": len(hora_invertida)}
    problemas["sesion_hora_fin_anterior_a_inicio"] = hora_invertida[:5]

    # --- Codificación -----------------------------------------------------
    reemplazos = sum(a.read_bytes().count("�".encode("utf-8")) for a in CACHE.glob("*.json"))
    cifras["codificacion"] = {"caracteres_de_reemplazo_en_cache": reemplazos}

    # --- Salidas ----------------------------------------------------------
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / "cifras.json").write_text(json.dumps(cifras, ensure_ascii=False, indent=2), encoding="utf-8")
    (SALIDA / "problemas.json").write_text(json.dumps(problemas, ensure_ascii=False, indent=2), encoding="utf-8")

    ejemplos = SALIDA / "ejemplos"
    ejemplos.mkdir(exist_ok=True)
    ley_ejemplo = leyes[0]
    idp = ley_ejemplo["proyecto"]["idProyecto"]
    vot_ejemplo = next((v for v in del_periodo if v.get("votaciones") and es_aprobacion_global(v)
                        and (v.get("proyecto") or {}).get("idProyecto") == idp), None) \
        or next((v for v in del_periodo if v.get("votaciones") and es_aprobacion_global(v)), None)
    muestras = {
        "ley_periodo.json": ley_ejemplo,
        "proyecto_tramitaciones.json": proyectos[idp],
        "proyecto_adjuntos.json": adjuntos[idp],
        "votacion.json": vot_ejemplo,
        "legislador_vigente.json": next(iter(vigentes.values()), None),
        "votacion_por_legislador.json": ejemplo_por_legislador,
        "periodo.json": periodos,
    }
    for nombre, obj in muestras.items():
        (ejemplos / nombre).write_text(json.dumps(recortar(sin_contacto(obj)), ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(cifras, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
