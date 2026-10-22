"""Identificador estable de cada persona: datos/propios/personas.json.

El `idLegislador` de la API cambia en cada legislatura, así que cada persona recibe un
slug propio (por ejemplo `juan-perez`) que se usa en su URL. Una vez asignado, el slug no
cambia aunque la fuente corrija la escritura del nombre: el importador solo agrega
personas nuevas y nunca modifica las existentes.

Unir a una misma persona entre legislaturas es una tarea manual (Fase 5): se agrega su
nuevo idLegislador a la entrada existente.
"""

import re
import unicodedata


def slug(texto):
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")


def nombre_completo(legislador):
    return " ".join(f"{legislador.get('nombres') or ''} {legislador.get('apellidos') or ''}".split())


def asignar(personas, legisladores, periodo_legislativo):
    """Asigna slug a cada legislador del período que todavía no tiene persona.

    `personas` es la lista actual de personas.json; `legisladores`, los registros oficiales
    del período. Devuelve (lista de personas actualizada, {idLegislador: slug}, slugs nuevos).
    """
    personas = [dict(p, legisladores=[dict(x) for x in p["legisladores"]]) for p in personas]
    por_id = {}
    for persona in personas:
        for registro in persona["legisladores"]:
            por_id[registro["idLegislador"]] = persona["slug"]
    usados = {p["slug"] for p in personas}

    nuevos = []
    for legislador in sorted(legisladores, key=lambda l: l["idLegislador"]):
        id_legislador = legislador["idLegislador"]
        if id_legislador in por_id:
            continue
        nombre = nombre_completo(legislador)
        base = slug(nombre) or f"legislador-{id_legislador}"
        candidato, n = base, 2
        while candidato in usados:
            candidato, n = f"{base}-{n}", n + 1
        usados.add(candidato)
        por_id[id_legislador] = candidato
        nuevos.append(candidato)
        personas.append({
            "slug": candidato,
            "nombre": nombre,
            "legisladores": [{"periodoLegislativo": periodo_legislativo, "idLegislador": id_legislador}],
        })

    for persona in personas:
        persona["legisladores"].sort(key=lambda r: (r["periodoLegislativo"], r["idLegislador"]))
    personas.sort(key=lambda p: p["slug"])
    return personas, por_id, nuevos
