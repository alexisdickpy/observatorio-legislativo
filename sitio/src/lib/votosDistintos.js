// Cuadro de legisladores con más votos distintos a la mayoría de su partido (alcance acordado en #54).
// Sin HTML. Usa las cifras de la vista comparativa (lib/legisladores.js, comparativa, campo
// mayoriaPartido, #39), sin recalcularlas, y nunca suma las cámaras. Solo por partido; la bancada se
// consulta en la tabla comparativa.

import { comparativa } from "./legisladores.js";

/** Votaciones comparables que necesita un legislador para entrar al cuadro. */
export const MINIMO_COMPARABLES = 50;
/** Legisladores por cámara en el cuadro y en la portada. */
export const CANTIDAD_CUADRO = 10;
export const CANTIDAD_PORTADA = 5;

/**
 * De mayor a menor porcentaje de votos distintos a la mayoría de su partido. A igual porcentaje,
 * primero el de más votaciones comparables; si también empatan, queda el orden de entrada (por apellido).
 */
const porMasDistintos = (a, b) =>
  b.fila.mayoriaPartido.porcentaje - a.fila.mayoriaPartido.porcentaje ||
  b.fila.mayoriaPartido.total - a.fila.mayoriaPartido.total ||
  a.posicion - b.posicion;

/**
 * Cuadro de una cámara a partir de sus filas de la vista comparativa (en orden por apellido).
 * - filas: hasta `cantidad` legisladores con al menos `minimo` votaciones comparables, de más a menos
 *   votos distintos (porMasDistintos).
 * - sinComparables: quienes tienen partido registrado pero ninguna votación comparable, porque en todas
 *   las que votaron fueron los únicos de su partido en emitir voto en su cámara. Por apellido.
 * - bajoMinimo: cuántos tienen entre 1 y `minimo` - 1 votaciones comparables.
 * - sinPartido: cuántos no tienen partido registrado en la API.
 */
export function cuadroDeCamara(filas, { minimo = MINIMO_COMPARABLES, cantidad = CANTIDAD_CUADRO } = {}) {
  const conPartido = filas.filter((f) => f.mayoriaPartido.grupo);
  return {
    filas: conPartido
      .map((fila, posicion) => ({ fila, posicion }))
      .filter(({ fila }) => fila.mayoriaPartido.total >= minimo)
      .sort(porMasDistintos)
      .slice(0, cantidad)
      .map(({ fila }) => fila),
    sinComparables: conPartido.filter((f) => f.mayoriaPartido.total === 0),
    bajoMinimo: conPartido.filter((f) => f.mayoriaPartido.total > 0 && f.mayoriaPartido.total < minimo).length,
    sinPartido: filas.length - conPartido.length,
  };
}

/** Cuadro de un período, por cámara, en el orden de la vista comparativa. */
export function votosDistintosAlPartido(periodo) {
  return {
    periodo,
    minimo: MINIMO_COMPARABLES,
    camaras: comparativa(periodo).camaras.map((c) => ({ camara: c.camara, votaciones: c.votaciones, ...cuadroDeCamara(c.filas) })),
  };
}
