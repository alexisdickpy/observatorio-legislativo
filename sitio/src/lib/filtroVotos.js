// Filtro del historial de votos de la ficha de legislador, por estado oficial del proyecto. Se usa en
// el navegador (componente FiltroVotos) y en las pruebas. Trabaja con el valor de filtro (slug) que
// prepara legisladores.js, sin tocar los valores oficiales.

/** Estado elegido en la dirección, o "" si no hay o no es una de las opciones. */
export function leerEstado(parametros, nombre, opciones) {
  const valor = (parametros.get(nombre) ?? "").trim();
  return opciones.includes(valor) ? valor : "";
}

/** La dirección con el estado elegido, sin el parámetro si es "todos". */
export function escribirEstado(parametros, nombre, estado) {
  const p = new URLSearchParams(parametros);
  if (estado) p.set(nombre, estado);
  else p.delete(nombre);
  return p;
}

/** Filas que cumplen el filtro, en el mismo orden. Con estado "" se devuelven todas. */
export const filtrarPorEstado = (filas, estado) => filas.filter((f) => !estado || f.estado === estado);

/** Texto del resultado del filtro, con el denominador. */
export function textoResultado(visibles, total) {
  if (visibles === total) return total === 1 ? "Se muestra la única votación." : `Se muestran las ${total} votaciones.`;
  if (visibles === 0) return "Ninguna votación cumple este filtro.";
  return visibles === 1 ? `Se muestra 1 de ${total} votaciones.` : `Se muestran ${visibles} de ${total} votaciones.`;
}
