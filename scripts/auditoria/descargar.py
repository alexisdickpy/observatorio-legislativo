"""Descarga a la caché local todo lo necesario para auditar el período 2023-2028.

Uso (desde la raíz del repositorio):
    python scripts/auditoria/descargar.py

La primera ejecución tarda varios minutos (unas 1.300 consultas). Las siguientes
reutilizan la caché de tmp/auditoria/cache/. Para medir datos nuevos, borrar esa carpeta.
"""

import sys

from api import obtener, paginar

PERIODO_LEGISLATIVO = "2023-2028"


def ids_periodos_parlamentarios():
    periodos = obtener("periodo")["datos"]
    return [p["idPeriodoParlamentario"] for p in periodos if p["periodoLegislativo"] == PERIODO_LEGISLATIVO]


def main():
    periodos = ids_periodos_parlamentarios()
    print(f"Períodos parlamentarios de {PERIODO_LEGISLATIVO}: {periodos}")

    proyectos = set()
    for p in periodos:
        leyes = obtener(f"ley/periodo/{p}")["datos"] or []
        proyectos.update(l["proyecto"]["idProyecto"] for l in leyes)
        for camara in ("S", "D"):
            obtener(f"sesion/periodo/{p}", {"idCamara": camara})
    print(f"Proyectos con ley sancionada: {len(proyectos)}")

    print("Listado completo de leyes (todas las épocas)...")
    total_leyes = sum(1 for _ in paginar("ley", tam_pagina=500))
    print(f"  {total_leyes} leyes")

    print("Listado completo de votaciones con sus votos...")
    total_votaciones = sum(1 for _ in paginar("votacion", tam_pagina=100))
    print(f"  {total_votaciones} votaciones")

    print("Legisladores...")
    for camara in ("S", "D"):
        obtener(f"legislador/camara/{camara}")
    vigentes = (obtener("legislador/camara/S")["datos"] or []) + (obtener("legislador/camara/D")["datos"] or [])
    obtener("legislador", {"idCamara": "A"})

    # Votaciones por legislador: se descargan para todos los vigentes para comprobar
    # si el listado general de votaciones está completo.
    for i, leg in enumerate(vigentes, 1):
        obtener(f"votacion/parlamentario/{leg['idLegislador']}")
        if i % 25 == 0:
            print(f"  votaciones por legislador: {i}/{len(vigentes)}")

    print("Detalle de cada proyecto con ley (tramitaciones, autores y adjuntos)...")
    for i, id_proyecto in enumerate(sorted(proyectos), 1):
        obtener(f"proyecto/{id_proyecto}/tramitaciones")
        obtener(f"proyecto/{id_proyecto}/adjuntos")
        if i % 50 == 0:
            print(f"  {i}/{len(proyectos)}")

    print("Descarga completa.")


if __name__ == "__main__":
    sys.exit(main())
