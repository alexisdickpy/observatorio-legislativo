// Prepara el detalle de cada registro de ley para su ficha: iniciativa, autores y votaciones
// nominales. Sin HTML.
//
// Criterios (ver docs/decisiones/0001-arquitectura.md y el alcance acordado en #7):
// - Todos los textos que se muestran son los oficiales, sin cambios. Los valores vacíos de la
//   fuente se devuelven como null para que la página diga "Sin dato".
// - Votaciones: las enlazadas en _propio.idVotaciones. Se agrupan por cámara (primero la Cámara de
//   Senadores, la cámara alta) y, dentro de cada cámara, van de la más reciente a la más antigua.
// - Categorías de voto oficiales, sin fusionar. Los totales son los que publica el Congreso; las
//   categorías sin total publicado (MOCIÓN 1, 2…) se cuentan desde los votos individuales y se
//   señalan como recuento propio.
// - Partido y bancada de cada votante: los de legisladores.json, que la API da por período.
// - Nombre conocido de un partido (datos/propios/partidos.json): se agrega aparte, para mostrarlo
//   entre paréntesis y señalado como propio. El nombre oficial no cambia.
// - Porcentajes sobre todos los legisladores del grupo registrados en la votación (incluidos
//   AUSENTE y NO VOTA), con el denominador escrito.

import { fuente, notas, partidosConocidos } from "./datos.js";
import * as rutas from "./rutas.js";
import { recortar } from "./texto.js";

/** Categorías con total publicado por el Congreso, en el orden en que se muestran. */
const TOTALES_OFICIALES = [
  ["SI", "totalSI"],
  ["NO", "totalNO"],
  ["ABSTENCIÓN/BLANCO", "totalAbstencion"],
  ["NO VOTA", "totalNoVota"],
  ["AUSENTE", "totalAusente"],
];
const CATEGORIAS_FINALES = ["NO VOTA", "AUSENTE"];

const valor = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : v);
const porNombre = (a, b) => a.localeCompare(b, "es");

const formatoPorcentaje = new Intl.NumberFormat("es-PY", { style: "percent", maximumFractionDigits: 1 });
const formatoNumero = new Intl.NumberFormat("es-PY");

/** "12 de 30 (40 %)". El denominador siempre se escribe. */
export function proporcion(cantidad, total) {
  const porcentaje = total ? cantidad / total : 0;
  const fraccion = `${formatoNumero.format(cantidad)} de ${formatoNumero.format(total)}`;
  const porcentajeTexto = formatoPorcentaje.format(porcentaje);
  return { cantidad, total, porcentaje, fraccion, porcentajeTexto, texto: `${fraccion} (${porcentajeTexto})` };
}

/** Orden de las columnas: SI, NO, ABSTENCIÓN/BLANCO, las demás presentes (MOCIÓN…), NO VOTA, AUSENTE. */
export function ordenarCategorias(categorias) {
  const fijas = TOTALES_OFICIALES.map(([c]) => c).filter((c) => !CATEGORIAS_FINALES.includes(c));
  const otras = [...new Set(categorias)]
    .filter((c) => !TOTALES_OFICIALES.some(([o]) => o === c))
    .sort(porNombre);
  return [...fijas, ...otras, ...CATEGORIAS_FINALES];
}

// Índices por período, armados una sola vez.
const indices = new Map();
function indice(periodo) {
  if (indices.has(periodo)) return indices.get(periodo);
  const agrupar = (lista, clave) => {
    const m = new Map();
    for (const x of lista) {
      const k = clave(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  const notasDelPeriodo = notas().filter((n) => n.periodoLegislativo === periodo);
  const i = {
    leyes: new Map(fuente(periodo, "leyes.json").map((r) => [r.idLey, r])),
    autores: agrupar(fuente(periodo, "autores.json"), (a) => a.idProyecto),
    votaciones: new Map(fuente(periodo, "votaciones.json").map((v) => [v.idVotacion, v])),
    votos: agrupar(fuente(periodo, "votos.csv"), (v) => Number(v.idVotacion)),
    legisladores: new Map(fuente(periodo, "legisladores.json").map((l) => [l.idLegislador, l])),
    notas: agrupar(notasDelPeriodo, (n) => `${n.entidad}:${n.id}`),
  };
  indices.set(periodo, i);
  return i;
}

/** Nombre conocido de un partido oficial, o null. */
export function nombreConocido(partidoOficial) {
  return partidosConocidos().find((p) => p.partidoPolitico === partidoOficial)?.nombreConocido ?? null;
}

const nombreDe = (l) => [valor(l.nombres), valor(l.apellidos)].filter(Boolean).join(" ") || null;

function prepararAutor(a, periodo) {
  const l = a.legislador ?? {};
  return {
    nombre: nombreDe(l),
    url: valor(l.appURL),
    partido: valor(l.partidoPolitico),
    partidoConocido: nombreConocido(l.partidoPolitico),
    bancada: valor(l.bancada),
    camara: valor(l.camaraParlamentario),
    legislatura: valor(l.periodoLegislativo),
    delPeriodo: a._propio?.delPeriodo ?? l.periodoLegislativo === periodo,
  };
}

/** Desglose de una votación por un campo del legislador (partido o bancada). */
function desglose(votos, campo, categorias) {
  const grupos = new Map();
  for (const v of votos) {
    const nombre = v[campo];
    if (!grupos.has(nombre)) grupos.set(nombre, []);
    grupos.get(nombre).push(v);
  }
  return [...grupos.entries()]
    .map(([nombre, lista]) => ({
      nombre,
      nombreConocido: campo === "partido" ? nombreConocido(nombre) : null,
      total: lista.length,
      celdas: categorias.map((categoria) =>
        proporcion(lista.filter((v) => v.sentido === categoria).length, lista.length),
      ),
    }))
    .sort((a, b) => b.total - a.total || porNombre(a.nombre ?? "", b.nombre ?? ""));
}

function prepararVotacion(v, i) {
  const t = v.tramitacion ?? {};
  const s = t.idSesion ?? {};
  const votos = (i.votos.get(v.idVotacion) ?? [])
    .map((voto) => {
      const l = i.legisladores.get(Number(voto.idLegislador)) ?? {};
      return {
        nombre: nombreDe(l),
        apellidos: valor(l.apellidos) ?? "",
        partido: valor(l.partidoPolitico),
        partidoConocido: nombreConocido(l.partidoPolitico),
        bancada: valor(l.bancada),
        sentido: voto.sentidoVotacion,
        observacion: valor(voto.observacion),
      };
    });
  const categorias = ordenarCategorias(votos.map((x) => x.sentido));
  const posicion = new Map(categorias.map((c, n) => [c, n]));
  votos.sort(
    (a, b) => posicion.get(a.sentido) - posicion.get(b.sentido) || porNombre(a.apellidos, b.apellidos),
  );
  const recuento = (c) => votos.filter((x) => x.sentido === c).length;
  const oficial = new Map(TOTALES_OFICIALES);
  const totales = categorias.map((categoria) => {
    const campo = oficial.get(categoria);
    const cantidad = campo ? v[campo] : recuento(categoria);
    return { categoria, ...proporcion(cantidad, votos.length), recuentoPropio: !campo };
  });
  return {
    id: v.idVotacion,
    ancla: `votacion-${v.idVotacion}`,
    url: valor(v.appURL) ?? rutas.votacionSilpy(v.idVotacion),
    fecha: valor(t.fechaTramite),
    fechaIso: t._propio?.fechaTramite ?? null,
    camara: valor(t.camaraTramite),
    etapa: valor(t.descripcionEtapa),
    subetapa: valor(t.descripcionSubEtapa),
    resultado: valor(t.resultadoTramite),
    descripcion: valor(v.descripcion),
    descripcionCorta: valor(v.descripcion) && recortar(v.descripcion, 90),
    observacion: valor(v.observacion),
    sesion: {
      numero: valor(s.numeroSesion),
      tipo: valor(s.tipoSesion),
      fecha: valor(s.fechaSesion),
      url: valor(s.appURL),
    },
    registrados: votos.length,
    categorias,
    totales,
    hayRecuentoPropio: totales.some((x) => x.recuentoPropio),
    totalesCoinciden: v._propio?.totalesCoinciden ?? true,
    recalculados: categorias.map((c) => ({ categoria: c, cantidad: recuento(c) })),
    porPartido: desglose(votos, "partido", categorias),
    porBancada: desglose(votos, "bancada", categorias),
    votos,
    notas: (i.notas.get(`votacion:${v.idVotacion}`) ?? []).map((n) => n.detalle),
  };
}

/** De la más reciente a la más antigua; a igual fecha, la de mayor id primero. */
const masRecientePrimero = (a, b) =>
  (b.fechaIso ?? "").localeCompare(a.fechaIso ?? "") || b.id - a.id;

/** Orden de las cámaras: primero la cámara alta. Las demás, por nombre. */
const ORDEN_CAMARAS = ["CAMARA DE SENADORES", "CAMARA DE DIPUTADOS"];
const posicionCamara = (c) => (ORDEN_CAMARAS.includes(c) ? ORDEN_CAMARAS.indexOf(c) : ORDEN_CAMARAS.length);

/** Agrupa por cámara (Senadores, luego Diputados); dentro, de la más reciente a la más antigua. */
export function agruparPorCamara(votaciones) {
  const camaras = new Map();
  for (const v of [...votaciones].sort(masRecientePrimero)) {
    if (!camaras.has(v.camara)) camaras.set(v.camara, []);
    camaras.get(v.camara).push(v);
  }
  return [...camaras.entries()]
    .map(([camara, lista]) => ({ camara, votaciones: lista }))
    .sort((a, b) => posicionCamara(a.camara) - posicionCamara(b.camara) || porNombre(a.camara ?? "", b.camara ?? ""));
}

/** Detalle de un registro de ley ya preparado por catalogo.js ({ periodo, idLey }). */
export function detalleDeRegistro({ periodo, idLey }) {
  const i = indice(periodo);
  const r = i.leyes.get(idLey);
  const p = r.proyecto ?? {};
  const propio = r._propio ?? {};
  const votaciones = (propio.idVotaciones ?? []).map((id) => prepararVotacion(i.votaciones.get(id), i));
  const autores = (i.autores.get(p.idProyecto) ?? [])
    .slice()
    .sort((a, b) => (a._propio?.orden ?? 0) - (b._propio?.orden ?? 0))
    .map((a) => prepararAutor(a, periodo));
  const enlaces = (ids) => (ids ?? []).map((id) => ({ id, url: rutas.votacionSilpy(id) }));
  const conNombreConocido =
    autores.some((a) => a.partidoConocido) ||
    votaciones.some((v) => v.porPartido.some((g) => g.nombreConocido));
  return {
    periodo,
    conNombreConocido,
    iniciativa: valor(p.iniciativa),
    ministerios: (p.ministerios ?? []).filter((m) => valor(m)),
    autores,
    votaciones: {
      cantidad: votaciones.length,
      indice: [...votaciones].sort(masRecientePrimero),
      camaras: agruparPorCamara(votaciones),
      noResueltas: enlaces(propio.idVotacionesNoResueltas),
      otrosPeriodos: enlaces(propio.idVotacionesOtrosPeriodos),
    },
    notas: (i.notas.get(`ley:${idLey}`) ?? []).map((n) => n.detalle),
  };
}
