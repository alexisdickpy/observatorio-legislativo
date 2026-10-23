// Lectura de datos/ durante la compilación. Es la única pieza del sitio que abre archivos.
// Nunca modifica valores oficiales: devuelve los registros tal como están en datos/.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/** Carpeta datos/ del repositorio. La compilación se ejecuta desde sitio/. */
export const carpetaDatos = resolve(process.env.DATOS_DIR ?? resolve(process.cwd(), "..", "datos"));

const cache = new Map();

export function leerJson(ruta) {
  if (!cache.has(ruta)) cache.set(ruta, JSON.parse(readFileSync(join(carpetaDatos, ruta), "utf-8")));
  return cache.get(ruta);
}

export const periodos = () => leerJson("periodos.json").periodos;
export const estado = () => leerJson("estado.json");
export const diccionario = () => leerJson("diccionario.json");

/** Registros de ley de todos los períodos, con el período al que pertenece cada archivo. */
export function registrosDeLey() {
  return periodos().flatMap((p) =>
    leerJson(`fuente/${p.id}/leyes.json`).map((registro) => ({ periodo: p.id, registro })),
  );
}

/** Todos los archivos de datos/, con su ruta relativa (separada con "/") y su tamaño en bytes. */
export function archivosDeDatos(carpeta = carpetaDatos) {
  return readdirSync(carpeta, { withFileTypes: true })
    .flatMap((e) => {
      const ruta = join(carpeta, e.name);
      if (e.isDirectory()) return archivosDeDatos(ruta);
      return [{ ruta: relative(carpetaDatos, ruta).split(sep).join("/"), bytes: statSync(ruta).size }];
    })
    .sort((a, b) => a.ruta.localeCompare(b.ruta));
}
