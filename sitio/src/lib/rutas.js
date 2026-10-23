// Único lugar donde se definen las URLs del sitio. Los componentes y páginas piden la
// dirección a este módulo y nunca la escriben a mano (ver docs/decisiones/0001-arquitectura.md).
// Si una URL publicada cambia, agregar una redirección permanente en public/_redirects.

export const inicio = () => "/";
export const leyes = () => "/leyes/";
export const ley = (numeroLey) => `/leyes/${encodeURIComponent(numeroLey)}/`;
/** Ancla (id) de cada votación dentro de la ficha de su ley. */
export const anclaVotacion = (idVotacion) => `votacion-${idVotacion}`;
export const votacionEnLey = (numeroLey, idVotacion) => `${ley(numeroLey)}#${anclaVotacion(idVotacion)}`;
export const legisladores = () => "/legisladores/";
/** Ficha de una persona, con el slug de datos/propios/personas.json. */
export const legislador = (slug) => `/legisladores/${encodeURIComponent(slug)}/`;
export const buscar = () => "/buscar/";
export const datosAbiertos = () => "/datos/";
export const privacidad = () => "/privacidad/";
/** Metodología; con sección, el ancla de esa parte (anclasMetodologia). */
export const metodologia = (seccion) => (seccion ? `/metodologia/#${seccion}` : "/metodologia/");
/** Secciones de la metodología a las que enlazan las fichas. */
export const anclasMetodologia = {
  categorias: "categorias-de-voto",
  votosLegislador: "votos-de-cada-legislador",
  afiliacion: "partido-y-bancada",
  problemas: "problemas-conocidos",
};

/** Repositorio público del proyecto: código, datos y licencias. */
const repositorio = "https://github.com/alexisdickpy/observatorio-legislativo-py";
export const codigoFuente = () => repositorio;
export const licenciaCodigo = () => `${repositorio}/blob/main/LICENSE`;
export const licenciaDatos = () => `${repositorio}/blob/main/LICENSE-DATOS.md`;
export const metodologiaTecnica = () => `${repositorio}/blob/main/docs/metodologia.md`;

/** Archivo de datos/ servido en /datos/… con la misma ruta que en el repositorio. */
export const archivoDatos = (ruta) => `/datos/${ruta}`;

/** Parámetros de la dirección del catálogo de leyes (?q=…&anio=…&camara=…&orden=…). */
export const parametrosCatalogo = { texto: "q", anio: "anio", camara: "camara", orden: "orden" };

/** Foto de un legislador reducida para su ficha (scripts/reducir-fotos.js). La original está en archivoDatos. */
export const fotoLegislador = (periodo, idLegislador) => `/fotos/${periodo}/${idLegislador}.jpg`;

/** Parámetros de la dirección del listado de legisladores (?q=…&camara=…&partido=……). */
export const parametrosLegisladores = {
  texto: "q",
  camara: "camara",
  partido: "partido",
  bancada: "bancada",
  departamento: "departamento",
};

/** Parámetro de la dirección de la búsqueda (?q=…). */
export const parametroBusqueda = "q";

/** Votación en SILpy, para las que no están en datos/ (otra legislatura o enlace no resuelto). */
export const votacionSilpy = (idVotacion) => `https://silpy.congreso.gov.py/votacion/${idVotacion}`;
