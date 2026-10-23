// Prepara la página de datos abiertos: qué archivos hay, su descripción y su tamaño.
// Las descripciones salen de datos/diccionario.json; las rutas, de lib/rutas.

import { archivosDeDatos, diccionario, periodos } from "./datos.js";
import * as rutas from "./rutas.js";

const GENERALES = {
  "diccionario.md": "Diccionario de datos: cada campo de cada tabla, con su tipo, su origen (oficial o propio) y su descripción.",
  "diccionario.json": "El mismo diccionario, en formato para programas.",
  "estado.json": "Fecha de la última comprobación con la fuente, última modificación y cantidades por período.",
  "periodos.json": "Períodos legislativos incluidos, con sus fechas.",
  "sincronizaciones.json": "Registro de las últimas sincronizaciones con la API del Congreso.",
  "README.md": "Explicación de los archivos y sus convenciones.",
};

const sinMarcas = (texto) => texto.replaceAll("`", "");

export function tamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb).toLocaleString("es-PY")} KB`;
  return `${(kb / 1024).toLocaleString("es-PY", { maximumFractionDigits: 1 })} MB`;
}

const formato = (ruta) => ruta.split(".").pop().toUpperCase();

/** Grupos de archivos para la página de descargas. Ningún archivo de datos/ queda fuera. */
export function descargas() {
  const archivos = new Map(archivosDeDatos().map((a) => [a.ruta, a]));
  const usados = new Set();
  const archivo = (ruta) => {
    const a = archivos.get(ruta);
    if (!a) return null;
    usados.add(ruta);
    return { ruta, url: rutas.archivoDatos(ruta), formato: formato(ruta), tamano: tamano(a.bytes) };
  };
  const tablas = Object.entries(diccionario().tablas);
  const tablasDe = (filtro, periodo) =>
    tablas
      .map(([nombre, t]) => ({
        nombre,
        descripcion: sinMarcas(t.descripcion),
        archivos: t.archivos
          .filter(filtro)
          .map((patron) => archivo(patron.replace("{período}", periodo)))
          .filter(Boolean),
      }))
      .filter((t) => t.archivos.length);

  const grupos = [
    {
      titulo: "Documentación y estado",
      tablas: Object.entries(GENERALES)
        .map(([ruta, descripcion]) => ({ nombre: ruta, descripcion, archivos: [archivo(ruta)].filter(Boolean) }))
        .filter((t) => t.archivos.length),
    },
    ...periodos().map((p) => ({
      titulo: `Período legislativo ${p.id}: valores oficiales`,
      tablas: tablasDe((a) => a.startsWith("fuente/"), p.id),
    })),
    { titulo: "Capa propia del proyecto", tablas: tablasDe((a) => a.startsWith("propios/"), "") },
  ];
  const otros = [...archivos.keys()].filter((r) => !usados.has(r));
  if (otros.length) {
    grupos.push({
      titulo: "Otros archivos",
      tablas: otros.map((ruta) => ({ nombre: ruta, descripcion: "", archivos: [archivo(ruta)] })),
    });
  }
  return grupos;
}
