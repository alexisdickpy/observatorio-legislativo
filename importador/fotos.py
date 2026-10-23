"""Copia propia de las fotos oficiales de los legisladores: datos/fotos/{período}/{idLegislador}.jpg.

Cada foto es la que publica el Congreso en el `fotoURL` del legislador, sin cambios. Se guarda una
copia para que el sitio la sirva desde su propio dominio: así no depende del servidor del Congreso
en cada visita ni hace que el navegador del visitante se conecte a él.

- Modo incremental: se descargan solo las fotos que faltan. Modo completo: se vuelven a descargar
  todas y se reescriben las que cambiaron.
- Sin foto publicada (`fotoURL` vacío o la imagen genérica `noimage`): no se guarda nada y se borra
  la copia anterior, si había.
- Si una descarga falla o lo descargado no es una imagen JPEG, se conserva la copia anterior y se
  devuelve un aviso: una foto no detiene la sincronización de los datos.
"""

from pathlib import Path

from .escribir import escribir_si_cambia

SIN_FOTO = "noimage"
INICIO_JPEG = b"\xff\xd8\xff"


def url_de_foto(legislador):
    """URL de la foto oficial, o None si el legislador no tiene foto publicada."""
    url = (legislador.get("fotoURL") or "").strip()
    if not url or url.rsplit("/", 1)[-1].lower().startswith(SIN_FOTO):
        return None
    return url


def sincronizar(legisladores, carpeta, descargar, completo):
    """Actualiza las fotos de `carpeta`. `descargar(url)` devuelve los bytes o lanza una excepción.

    Devuelve (archivos modificados o borrados, avisos).
    """
    carpeta = Path(carpeta)
    esperadas = {}
    for legislador in legisladores:
        url = url_de_foto(legislador)
        if url:
            esperadas[f"{legislador['idLegislador']}.jpg"] = url
    cambiados, avisos = [], []
    for nombre, url in sorted(esperadas.items()):
        ruta = carpeta / nombre
        if ruta.exists() and not completo:
            continue
        try:
            contenido = descargar(url)
        except Exception as e:  # cualquier falla de red o de la respuesta
            avisos.append(f"No se pudo descargar la foto {url}: {e}")
            continue
        if not contenido.startswith(INICIO_JPEG):
            avisos.append(f"La foto {url} no es una imagen JPEG; se conserva la copia anterior")
            continue
        if escribir_si_cambia(ruta, contenido):
            cambiados.append(ruta)
    if carpeta.exists():
        for ruta in sorted(carpeta.glob("*.jpg")):
            if ruta.name not in esperadas:
                ruta.unlink()
                cambiados.append(ruta)
    return cambiados, avisos
