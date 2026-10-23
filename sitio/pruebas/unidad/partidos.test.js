// Pruebas de la tabla de partidos unificados (datos/propios/partidos.json) contra los legisladores de
// cada período y del filtro de partidos del listado.
import assert from "node:assert/strict";
import { test } from "node:test";

import { fuente, partidosConocidos, periodos } from "../../src/lib/datos.js";
import { ficha, legisladores, listado, opcionesDelListado } from "../../src/lib/legisladores.js";
import { partidoUnificado, tablaDePartidos, textosSinIdentificador } from "../../src/lib/partidos.js";

const PERIODO = "2023-2028";
const textosDe = (periodo, campo = "partidoPolitico") => fuente(periodo, "legisladores.json").map((l) => l[campo]);
const CRUZADA_SEN = "Partido Cruzada Nacional";
const CRUZADA_DIP = "CRUZADA NACIONAL";

test("cada texto oficial de partido de cada período tiene identificador unificado", () => {
  for (const p of periodos()) {
    const faltan = textosSinIdentificador(textosDe(p.id));
    assert.deepEqual(faltan, [], `Textos de partido sin identificador en ${p.id}; agregarlos a datos/propios/partidos.json`);
  }
});

test("la prueba detecta un texto de partido nuevo", () => {
  assert.deepEqual(textosSinIdentificador(["Partido Nuevo", CRUZADA_DIP, "", null, "Partido Nuevo"]), ["Partido Nuevo"]);
  // El sitio compila igual: el texto nuevo queda solo, con el slug de su texto.
  assert.deepEqual(partidoUnificado("Partido Nuevo"), { id: "partido-nuevo", nombre: "Partido Nuevo", enTabla: false });
  assert.equal(partidoUnificado(""), null);
});

test("tabla completa: una entrada por texto, identificador, nombre y fundamento en cada una", () => {
  const entradas = partidosConocidos();
  assert.equal(new Set(entradas.map((e) => e.partidoPolitico)).size, entradas.length);
  for (const e of entradas) {
    assert.match(e.partidoUnificado, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.partidoPolitico);
    assert.ok(e.nombreUnificado?.trim(), e.partidoPolitico);
    assert.ok(e.fundamentoUnificado?.trim().length > 20, e.partidoPolitico);
    assert.equal(Boolean(e.nombreConocido), Boolean(e.fundamentoNombreConocido), e.partidoPolitico);
  }
  // Un identificador, un solo nombre.
  const nombres = new Map();
  for (const e of entradas) {
    assert.equal(nombres.get(e.partidoUnificado) ?? e.nombreUnificado, e.nombreUnificado, e.partidoUnificado);
    nombres.set(e.partidoUnificado, e.nombreUnificado);
  }
  // Ningún texto de la tabla falta en los datos: no quedan entradas sobrantes.
  const usados = new Set(periodos().flatMap((p) => textosDe(p.id)));
  assert.deepEqual(entradas.map((e) => e.partidoPolitico).filter((t) => !usados.has(t)), []);
});

test("2023-2028: 12 textos, 11 partidos; solo se agrupa Cruzada Nacional", () => {
  const textos = new Set(textosDe(PERIODO).filter(Boolean));
  assert.equal(textos.size, 12);
  assert.equal(new Set([...textos].map((t) => partidoUnificado(t).id)).size, 11);
  assert.equal(partidoUnificado(CRUZADA_SEN).id, partidoUnificado(CRUZADA_DIP).id);
  assert.equal(partidoUnificado(CRUZADA_DIP).nombre, CRUZADA_SEN);
  assert.notEqual(partidoUnificado("Independiente A").id, partidoUnificado("INDEPENDIENTE").id);
  const agrupados = tablaDePartidos().filter((g) => g.textos.length > 1);
  assert.deepEqual(agrupados.map((g) => g.textos.map((t) => t.texto)), [[CRUZADA_DIP, CRUZADA_SEN]]);
});

test("ningún valor oficial cambia: el listado conserva el texto oficial del partido", () => {
  const oficial = new Map(fuente(PERIODO, "legisladores.json").map((l) => [l.idLegislador, l]));
  const { enEjercicio, noEjercen } = listado(PERIODO);
  for (const r of [...enEjercicio, ...noEjercen]) {
    const o = oficial.get(r.id);
    assert.equal(r.partido, o.partidoPolitico?.trim() ? o.partidoPolitico : null);
    assert.equal(r.filtro.partido, r.partidoUnificado?.id ?? "");
  }
});

test("filtro de partido: Cruzada Nacional una sola vez, con las dos cámaras", () => {
  const { partidos } = opcionesDelListado(PERIODO);
  const cruzada = partidos.filter((p) => p.etiqueta.includes("ruzada") || p.etiqueta.includes("RUZADA"));
  assert.deepEqual(cruzada, [{ valor: "partido-cruzada-nacional", etiqueta: CRUZADA_SEN }]);
  assert.equal(partidos.length, 11);
  const { enEjercicio, noEjercen } = listado(PERIODO);
  const camaras = new Set([...enEjercicio, ...noEjercen].filter((l) => l.filtro.partido === "partido-cruzada-nacional").map((l) => l.camara));
  assert.deepEqual([...camaras].sort(), ["CAMARA DE DIPUTADOS", "CAMARA DE SENADORES"]);
  // Los partidos de un solo texto conservan el valor de URL anterior (slug del texto oficial).
  assert.ok(partidos.some((p) => p.valor === "movimiento-conciencia-democratica-nacional" && p.etiqueta.endsWith("(Yo Creo)")));
});

test("ficha: muestra solo el texto oficial del partido", () => {
  const bloques = legisladores().flatMap((p) => ficha(p).bloques).filter((b) => b.periodo === PERIODO);
  const dip = bloques.filter((b) => b.partidoUnificado?.id === "partido-cruzada-nacional" && b.camara === "CAMARA DE DIPUTADOS");
  assert.ok(dip.length > 0);
  assert.ok(dip.every((b) => b.partido === CRUZADA_DIP));
});
