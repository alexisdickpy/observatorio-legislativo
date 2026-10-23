// Filtro del listado de legisladores. Se usa en el navegador (componente FiltroLegisladores) y en
// las pruebas. Trabaja con las "entradas" que prepara legisladores.js, sin tocar los valores oficiales.

import { normalizar } from "./texto.js";

export const CAMPOS = ["texto", "camara", "partido", "bancada", "departamento"];

/** Lee los filtros desde URLSearchParams. */
export function leerFiltros(parametros, nombres) {
  return Object.fromEntries(CAMPOS.map((c) => [c, (parametros.get(nombres[c]) ?? "").trim()]));
}

/** Escribe los filtros como URLSearchParams, omitiendo los vacíos. */
export function escribirFiltros(filtros, nombres) {
  const p = new URLSearchParams();
  for (const c of CAMPOS) if (filtros[c]) p.set(nombres[c], filtros[c]);
  return p;
}

/**
 * Entradas que cumplen los filtros, en el mismo orden.
 * Cada entrada: { slug, textoBusqueda, camara, partido, bancada, departamento } (valores en slug).
 * El texto se busca por palabras: todas deben aparecer en el nombre, sin importar acentos.
 */
export function filtrar(entradas, filtros) {
  const palabras = normalizar(filtros.texto).split(" ").filter(Boolean);
  const campos = CAMPOS.filter((c) => c !== "texto" && filtros[c]);
  return entradas.filter(
    (e) => campos.every((c) => e[c] === filtros[c]) && palabras.every((p) => e.textoBusqueda.includes(p)),
  );
}
