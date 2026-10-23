// Único lugar donde se definen las URLs del sitio. Los componentes y páginas piden la
// dirección a este módulo y nunca la escriben a mano (ver docs/decisiones/0001-arquitectura.md).
// Si una URL publicada cambia, agregar una redirección permanente en public/_redirects.

export const inicio = () => "/";
export const leyes = () => "/leyes/";
export const ley = (numeroLey) => `/leyes/${encodeURIComponent(numeroLey)}/`;
export const buscar = () => "/buscar/";
export const datosAbiertos = () => "/datos/";

/** Archivo de datos/ servido en /datos/… con la misma ruta que en el repositorio. */
export const archivoDatos = (ruta) => `/datos/${ruta}`;

/** Parámetros de la dirección del catálogo de leyes (?q=…&anio=…&camara=…&orden=…). */
export const parametrosCatalogo = { texto: "q", anio: "anio", camara: "camara", orden: "orden" };

/** Parámetro de la dirección de la búsqueda (?q=…). */
export const parametroBusqueda = "q";

/** Votación en SILpy, para las que no están en datos/ (otra legislatura o enlace no resuelto). */
export const votacionSilpy = (idVotacion) => `https://silpy.congreso.gov.py/votacion/${idVotacion}`;
