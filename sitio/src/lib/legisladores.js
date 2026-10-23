// Prepara el listado y las fichas de legisladores. Sin HTML.
//
// Criterios (alcance acordado en #8):
// - Una ficha por persona (slug de datos/propios/personas.json) con un bloque por cada período en
//   que fue legislador. Tienen ficha todos los legisladores del período, en ejercicio o no
//   (_propio.vigente: si figura en el listado de legisladores en ejercicio de la API).
// - Los textos que se muestran son los oficiales, sin cambios. Los vacíos se devuelven como null
//   para que la página diga "Sin dato".
// - Votos: los de cada votación nominal vinculada a una ley sancionada del período
//   (_propio.idLeyes) en cuya lista oficial figura el legislador. Categorías oficiales sin
//   fusionar; cada cantidad lleva su denominador. "AUSENTE" se informa como "ausencias en
//   votaciones nominales", no como ausencias a la sesión.
// - Autoría: leyes sancionadas del período de cuyo proyecto figura como autor (autores.json,
//   registros con _propio.delPeriodo).
// - Partido y bancada: los que la API registra para el período, no por fecha.
// - Correo y teléfono: los que la API publica para el legislador, sin cambios.
// - Orden: primero la Cámara de Senadores y luego la de Diputados; dentro, por apellido.

import { existeEnDatos, fuente, periodos, personas } from "./datos.js";
import {
  barra,
  claseDeCategoria,
  indice,
  masRecientePrimero,
  nombreConocido,
  nombreDe,
  ordenarCategorias,
  posicionCamara,
  proporcion,
  valor,
} from "./ficha.js";
import * as rutas from "./rutas.js";
import { normalizar, recortar, slug } from "./texto.js";

const AUSENTE = "AUSENTE";
const porTexto = (a, b) => a.localeCompare(b, "es");
const porCamaraYApellido = (a, b) =>
  posicionCamara(a.camara) - posicionCamara(b.camara) ||
  porTexto(normalizar(a.apellidos), normalizar(b.apellidos)) ||
  porTexto(normalizar(a.nombre), normalizar(b.nombre));

// Votos de cada legislador en las votaciones vinculadas a leyes, por período.
const votosPorPeriodo = new Map();
function votosDelPeriodo(periodo) {
  if (votosPorPeriodo.has(periodo)) return votosPorPeriodo.get(periodo);
  const i = indice(periodo);
  const porLegislador = new Map();
  for (const [idVotacion, votos] of i.votos) {
    const v = i.votaciones.get(idVotacion);
    if (!v?._propio?.idLeyes?.length) continue;
    for (const voto of votos) {
      const id = Number(voto.idLegislador);
      if (!porLegislador.has(id)) porLegislador.set(id, []);
      porLegislador.get(id).push({ votacion: v, sentido: voto.sentidoVotacion, observacion: valor(voto.observacion) });
    }
  }
  votosPorPeriodo.set(periodo, porLegislador);
  return porLegislador;
}

// Proyectos de cada autor del período, por período.
const autoriaPorPeriodo = new Map();
function autoriaDelPeriodo(periodo) {
  if (autoriaPorPeriodo.has(periodo)) return autoriaPorPeriodo.get(periodo);
  const porLegislador = new Map();
  for (const a of fuente(periodo, "autores.json")) {
    if (!a._propio?.delPeriodo) continue;
    const id = a.legislador?.idLegislador;
    if (!porLegislador.has(id)) porLegislador.set(id, new Set());
    porLegislador.get(id).add(a.idProyecto);
  }
  autoriaPorPeriodo.set(periodo, porLegislador);
  return porLegislador;
}

/** Ley o leyes de una votación: número (enlace a la votación en su ficha) y título oficial. */
function leyesDeVotacion(v, i) {
  const vistas = new Map();
  for (const idLey of v._propio.idLeyes) {
    const r = i.leyes.get(idLey);
    const numero = r?._propio?.numeroLey;
    if (!numero || vistas.has(numero)) continue;
    const titulo = valor(r.proyecto?.acapite);
    vistas.set(numero, {
      numero,
      url: rutas.votacionEnLey(numero, v.idVotacion),
      titulo,
      tituloCorto: titulo && recortar(titulo, 70),
    });
  }
  return [...vistas.values()];
}

function resumenDeVotos(lista) {
  const categorias = ordenarCategorias(lista.map((x) => x.sentido));
  const celdas = categorias.map((c) => proporcion(lista.filter((x) => x.sentido === c).length, lista.length));
  return {
    total: lista.length,
    totales: categorias.map((categoria, n) => ({ categoria, clase: claseDeCategoria(categoria), ...celdas[n] })),
    barra: barra(categorias, celdas),
    ausencias: celdas[categorias.indexOf(AUSENTE)],
  };
}

function historialDeVotos(lista, i) {
  return lista
    .map(({ votacion: v, sentido, observacion }) => {
      const t = v.tramitacion ?? {};
      return {
        id: v.idVotacion,
        fecha: valor(t.fechaTramite),
        fechaIso: t._propio?.fechaTramite ?? null,
        etapa: valor(t.descripcionEtapa),
        resultado: valor(t.resultadoTramite),
        leyes: leyesDeVotacion(v, i),
        sentido,
        clase: claseDeCategoria(sentido),
        observacion,
      };
    })
    .sort(masRecientePrimero);
}

function leyesDeSuAutoria(idLegislador, periodo, i) {
  const proyectos = autoriaDelPeriodo(periodo).get(idLegislador) ?? new Set();
  const porNumero = new Map();
  for (const r of i.leyes.values()) {
    if (!proyectos.has(r.proyecto?.idProyecto)) continue;
    const numero = r._propio.numeroLey;
    if (porNumero.has(numero)) continue;
    porNumero.set(numero, {
      numero,
      url: rutas.ley(numero),
      titulo: valor(r.proyecto?.acapite),
      fechaSancion: valor(r.fechaSancion),
      fechaIso: r._propio?.fechaSancion ?? null,
    });
  }
  return [...porNumero.values()].sort(
    (a, b) => (b.fechaIso ?? "").localeCompare(a.fechaIso ?? "") || Number(b.numero) - Number(a.numero),
  );
}

/** Datos oficiales de un legislador en un período, para el listado y el encabezado de la ficha. */
function prepararRegistro(l, periodo) {
  const foto = `fotos/${periodo}/${l.idLegislador}.jpg`;
  const partido = valor(l.partidoPolitico);
  return {
    periodo,
    id: l.idLegislador,
    nombre: nombreDe(l),
    apellidos: valor(l.apellidos) ?? "",
    camara: valor(l.camaraParlamentario),
    tipo: valor(l.tipoParlamentario),
    departamento: valor(l.departamento),
    partido,
    partidoConocido: nombreConocido(partido),
    bancada: valor(l.bancada),
    cargoBancada: valor(l.cargoBancada),
    correo: valor(l.emailParlamentario),
    telefono: valor(l.telefonoParlamentario),
    vigente: Boolean(l._propio?.vigente),
    urlSilpy: valor(l.appURL),
    foto: existeEnDatos(foto) ? rutas.fotoLegislador(periodo, l.idLegislador) : null,
  };
}

let cachePersonas;

/** Una entrada por persona con ficha: su slug, su URL y sus registros por período (el más reciente primero). */
export function legisladores() {
  if (cachePersonas) return cachePersonas;
  const orden = periodos().map((p) => p.id);
  cachePersonas = personas()
    .map((p) => {
      const registros = p.legisladores
        .filter((x) => orden.includes(x.periodoLegislativo))
        .map((x) => {
          const l = indice(x.periodoLegislativo).legisladores.get(x.idLegislador);
          return l && prepararRegistro(l, x.periodoLegislativo);
        })
        .filter(Boolean)
        .sort((a, b) => orden.indexOf(b.periodo) - orden.indexOf(a.periodo));
      return { slug: p.slug, url: rutas.legislador(p.slug), registros };
    })
    .filter((p) => p.registros.length);
  return cachePersonas;
}

const CAMPOS_FILTRO = ["camara", "partido", "bancada", "departamento"];

/**
 * Valor de URL de cada texto oficial (su slug). Si dos textos distintos dan el mismo slug
 * (por ejemplo, «"PEN"» y «(PEN)»), el segundo en orden alfabético recibe "-2": no se fusionan.
 */
function valoresUnicos(textos) {
  const valores = new Map();
  const usados = new Set();
  for (const t of [...new Set(textos.filter(Boolean))].sort(porTexto)) {
    const base = slug(t) || "sin-nombre";
    let v = base;
    for (let n = 2; usados.has(v); n++) v = `${base}-${n}`;
    usados.add(v);
    valores.set(t, v);
  }
  return valores;
}

const listados = new Map();

/**
 * Legisladores de un período para el listado: en ejercicio y los que ya no ejercen, por separado.
 * Cada fila lleva la entrada que usa el filtro (lib/filtroLegisladores.js).
 */
export function listado(periodo) {
  if (listados.has(periodo)) return listados.get(periodo);
  const filas = legisladores()
    .map((p) => {
      const r = p.registros.find((x) => x.periodo === periodo);
      return r && { ...r, slug: p.slug, url: p.url };
    })
    .filter(Boolean)
    .sort(porCamaraYApellido);
  const valores = Object.fromEntries(CAMPOS_FILTRO.map((c) => [c, valoresUnicos(filas.map((r) => r[c]))]));
  for (const r of filas) {
    r.filtro = {
      slug: r.slug,
      textoBusqueda: normalizar(r.nombre),
      ...Object.fromEntries(CAMPOS_FILTRO.map((c) => [c, valores[c].get(r[c]) ?? ""])),
    };
  }
  const resultado = { enEjercicio: filas.filter((r) => r.vigente), noEjercen: filas.filter((r) => !r.vigente), valores };
  listados.set(periodo, resultado);
  return resultado;
}

/** Opciones de los filtros del listado: valor de URL y texto oficial (con el nombre conocido del partido). */
export function opcionesDelListado(periodo) {
  const { valores } = listado(periodo);
  const opciones = (campo, conocido = () => null) =>
    [...valores[campo].entries()].map(([texto, valor]) => {
      const extra = conocido(texto);
      return { valor, etiqueta: extra ? `${texto} (${extra})` : texto };
    });
  return {
    camaras: opciones("camara").sort((a, b) => posicionCamara(a.etiqueta) - posicionCamara(b.etiqueta)),
    partidos: opciones("partido", nombreConocido),
    bancadas: opciones("bancada"),
    departamentos: opciones("departamento"),
  };
}

/** Ficha de una persona: por período, sus datos, el resumen y el historial de sus votos y sus leyes. */
export function ficha(persona) {
  const bloques = persona.registros.map((r) => {
    const i = indice(r.periodo);
    const lista = votosDelPeriodo(r.periodo).get(r.id) ?? [];
    return {
      ...r,
      periodoVigente: Boolean(periodos().find((p) => p.id === r.periodo)?.vigente),
      votos: { ...resumenDeVotos(lista), historial: historialDeVotos(lista, i) },
      autoria: leyesDeSuAutoria(r.id, r.periodo, i),
    };
  });
  return {
    slug: persona.slug,
    nombre: bloques[0].nombre,
    conNombreConocido: bloques.some((b) => b.partidoConocido),
    bloques,
  };
}
