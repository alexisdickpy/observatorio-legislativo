// Orden de la vista comparativa de votaciones nominales. Se usa en el navegador (componente
// OrdenComparativa) y en las pruebas. No califica: ordenar por una cifra solo cambia el orden de las
// filas, de mayor a menor porcentaje, y los empates quedan en el orden por nombre.

/** Órdenes posibles: valor en la dirección, texto del selector y campo de la cifra (null = por nombre). */
export const ORDENES = [
  { valor: "", etiqueta: "Nombre (por apellido)", campo: null },
  { valor: "ausencias", etiqueta: "Ausencias en votaciones nominales (de mayor a menor %)", campo: "ausencias" },
  { valor: "no-vota", etiqueta: "NO VOTA (de mayor a menor %)", campo: "noVota" },
  { valor: "abstencion", etiqueta: "ABSTENCIÓN/BLANCO (de mayor a menor %)", campo: "abstencion" },
  { valor: "bancada", etiqueta: "Votos distintos a la mayoría de su bancada (de mayor a menor %)", campo: "mayoriaBancada" },
  { valor: "partido", etiqueta: "Votos distintos a la mayoría de su partido (de mayor a menor %)", campo: "mayoriaPartido" },
];

/** Orden pedido en la dirección; uno desconocido vuelve al orden por nombre. */
export function leerOrden(parametros, nombre) {
  const valor = (parametros.get(nombre) ?? "").trim();
  return ORDENES.some((o) => o.valor === valor) ? valor : "";
}

/**
 * Entradas en el orden pedido. Cada entrada: { slug, posicion (orden por nombre), ausencias, noVota,
 * abstencion, mayoriaBancada, mayoriaPartido } con los porcentajes como números entre 0 y 1; -1 para
 * quien no tiene votaciones comparables, que queda al final.
 */
export function ordenar(entradas, valor) {
  const campo = ORDENES.find((o) => o.valor === valor)?.campo;
  return [...entradas].sort((a, b) => (campo ? b[campo] - a[campo] : 0) || a.posicion - b.posicion);
}
