// Vista previa de las vistas de análisis en la portada (alcance acordado en #51). Sin HTML. Solo
// datos por cámara y sin nombres de personas; las cifras salen de los mismos cálculos que las páginas
// de cada vista (lib/coincidencia.js y lib/legisladores.js), nunca se suman las cámaras.

import { coincidencia } from "./coincidencia.js";
import { comparativa } from "./legisladores.js";

const porMayorCoincidencia = (a, b) => b.porcentaje - a.porcentaje || b.total - a.total || a.nombres.localeCompare(b.nombres, "es");

/**
 * Pares de partidos de una cámara con porcentaje (al menos UMBRAL votaciones en común), de mayor a
 * menor coincidencia. A igual porcentaje, primero el de más votaciones en común.
 */
export function paresConPorcentaje(cuadro) {
  const pares = [];
  cuadro.filas.forEach((a, i) => {
    cuadro.filas.forEach((b, j) => {
      const c = a.celdas[j];
      if (j > i && c?.suficiente) pares.push({ ...c, a: a.nombre, b: b.nombre, nombres: `${a.nombre} ${b.nombre}` });
    });
  });
  return pares.sort(porMayorCoincidencia);
}

/**
 * Barras del gráfico de una cámara: la coincidencia de cada partido con el de más legisladores en
 * ejercicio en esa cámara (la primera fila del cuadro). Primero los que tienen porcentaje, de mayor a
 * menor; después, los que no alcanzan el umbral (sin barra, solo las cantidades).
 */
export function barrasDeReferencia(cuadro) {
  const [referencia, ...otros] = cuadro.filas;
  if (!referencia) return { referencia: null, barras: [] };
  const barras = otros
    .map((f) => ({ ...referencia.celdas[cuadro.filas.indexOf(f)], nombre: f.nombre, nombres: f.nombre }))
    .filter((b) => b.total > 0)
    .sort((a, b) => Number(b.suficiente) - Number(a.suficiente) || porMayorCoincidencia(a, b));
  return { referencia: referencia.nombre, barras };
}

/**
 * Vista previa de un período.
 * - coincidencia: por cámara, sus votaciones sobre proyectos de ley, el par de partidos con más y con
 *   menos coincidencia (null si la cámara no tiene al menos dos pares con porcentaje) y las barras del
 *   gráfico (barrasDeReferencia).
 * - votacionesNominales: por cámara, cuántas votaciones nominales tiene y cuántos legisladores se comparan.
 */
export function vistaPrevia(periodo) {
  const c = coincidencia(periodo);
  return {
    coincidencia: c.cuadros.map((cuadro) => {
      const pares = paresConPorcentaje(cuadro);
      return {
        camara: cuadro.camara,
        votaciones: c.camaras.find((x) => x.camara === cuadro.camara).votaciones,
        mayor: pares.length > 1 ? pares[0] : null,
        menor: pares.length > 1 ? pares.at(-1) : null,
        ...barrasDeReferencia(cuadro),
      };
    }),
    votacionesNominales: comparativa(periodo).camaras.map((x) => ({
      camara: x.camara,
      votaciones: x.votaciones,
      legisladores: x.filas.length,
    })),
  };
}
