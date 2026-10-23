// Lectura de datos/ durante la compilación. Es la única pieza del sitio que abre archivos.
// Nunca modifica valores oficiales: devuelve los registros tal como están en datos/.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/** Carpeta datos/ del repositorio. La compilación se ejecuta desde sitio/. */
export const carpetaDatos = resolve(process.env.DATOS_DIR ?? resolve(process.cwd(), "..", "datos"));

const cache = new Map();

export function leerJson(ruta) {
  if (!cache.has(ruta)) cache.set(ruta, JSON.parse(readFileSync(join(carpetaDatos, ruta), "utf-8")));
  return cache.get(ruta);
}

/** CSV con encabezado (RFC 4180, UTF-8 con o sin BOM): una lista de objetos con valores de texto. */
export function leerCsv(ruta) {
  if (!cache.has(ruta)) cache.set(ruta, interpretarCsv(readFileSync(join(carpetaDatos, ruta), "utf-8")));
  return cache.get(ruta);
}

export function interpretarCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let comillas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [encabezado, ...resto] = filas;
  return resto.map((f) => Object.fromEntries(encabezado.map((nombre, i) => [nombre, f[i] ?? ""])));
}

export const periodos = () => leerJson("periodos.json").periodos;
export const estado = () => leerJson("estado.json");
export const diccionario = () => leerJson("diccionario.json");
export const notas = () => leerJson("propios/notas.json").notas;
export const partidosConocidos = () => leerJson("propios/partidos.json").partidos;
export const personas = () => leerJson("propios/personas.json").personas;

/** Si existe un archivo en datos/ (por ejemplo, una foto guardada por el importador). */
export const existeEnDatos = (ruta) => existsSync(join(carpetaDatos, ruta));

/** Un archivo de un período tal como está en datos/fuente/{período}/. */
export const fuente = (periodo, archivo) =>
  archivo.endsWith(".csv") ? leerCsv(`fuente/${periodo}/${archivo}`) : leerJson(`fuente/${periodo}/${archivo}`);

/** Registros de ley de todos los períodos, con el período al que pertenece cada archivo. */
export function registrosDeLey() {
  return periodos().flatMap((p) =>
    leerJson(`fuente/${p.id}/leyes.json`).map((registro) => ({ periodo: p.id, registro })),
  );
}

/** Carpeta de las fotos de legisladores: se sirven en el sitio, pero no son una tabla de datos. */
export const CARPETA_FOTOS = "fotos";

/**
 * Todos los archivos de datos/, con su ruta relativa (separada con "/") y su tamaño en bytes.
 * Sin las fotos de datos/fotos/, que la página de descargas presenta aparte.
 */
export function archivosDeDatos(carpeta = carpetaDatos) {
  return readdirSync(carpeta, { withFileTypes: true })
    .flatMap((e) => {
      const ruta = join(carpeta, e.name);
      if (e.isDirectory() && carpeta === carpetaDatos && e.name === CARPETA_FOTOS) return [];
      if (e.isDirectory()) return archivosDeDatos(ruta);
      return [{ ruta: relative(carpetaDatos, ruta).split(sep).join("/"), bytes: statSync(ruta).size }];
    })
    .sort((a, b) => a.ruta.localeCompare(b.ruta));
}
