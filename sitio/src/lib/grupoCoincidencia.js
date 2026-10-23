// Grupo elegido en la página de coincidencia de votos. Se usa en el navegador (componente
// SelectorCoincidencia) y en las pruebas.

/** Grupo pedido en la dirección (?grupo=…); uno desconocido o vacío vuelve al primero. */
export function leerGrupo(parametros, nombre, validos) {
  const valor = (parametros.get(nombre) ?? "").trim();
  return validos.includes(valor) ? valor : (validos[0] ?? "");
}

/** Dirección con el grupo elegido; el primero (el de partida) no se escribe. */
export function escribirGrupo(parametros, nombre, valor, validos) {
  const p = new URLSearchParams(parametros);
  if (valor && valor !== validos[0]) p.set(nombre, valor);
  else p.delete(nombre);
  return p;
}
