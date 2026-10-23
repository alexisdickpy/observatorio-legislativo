// Utilidades de texto sin HTML ni lectura de archivos: se usan en la compilación y en el navegador.

/** Minúsculas, sin acentos ni signos: para comparar textos al buscar. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** Identificador de URL a partir de un valor oficial: "CAMARA DE DIPUTADOS" → "camara-de-diputados". */
export function slug(texto) {
  return normalizar(texto).replace(/ /g, "-");
}
