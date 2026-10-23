// Pruebas del listado y las fichas de legisladores con casos reales de datos/.
// Los legisladores en ejercicio suman votos con cada ley nueva: para ellos se comprueban votos ya
// cerrados o un recuento hecho aparte; las cantidades fijas son de quienes ya no ejercen.
import assert from "node:assert/strict";
import { test } from "node:test";

import { estado, fuente, periodos, personas } from "../../src/lib/datos.js";
import { escribirFiltros, filtrar, leerFiltros } from "../../src/lib/filtroLegisladores.js";
import { ficha, legisladores, listado, opcionesDelListado } from "../../src/lib/legisladores.js";
import { parametrosLegisladores as nombres } from "../../src/lib/rutas.js";

const PERIODO = "2023-2028";
const de = (slug) => ficha(legisladores().find((p) => p.slug === slug)).bloques[0];
const todas = () => listado(PERIODO);
const entradas = () => [...todas().enEjercicio, ...todas().noEjercen].map((l) => l.filtro);
const buscar = (cambios) =>
  filtrar(entradas(), { texto: "", camara: "", partido: "", bancada: "", departamento: "", ...cambios }).map(
    (e) => e.slug,
  );

test("una ficha por persona de personas.json; en ejercicio, la cantidad de estado.json", () => {
  assert.equal(legisladores().length, personas().length);
  assert.equal(new Set(legisladores().map((p) => p.slug)).size, legisladores().length);
  const { enEjercicio, noEjercen } = todas();
  assert.equal(enEjercicio.length, estado().periodos[PERIODO].cantidades.legisladoresVigentes);
  assert.equal(enEjercicio.length + noEjercen.length, fuente(PERIODO, "legisladores.json").length);
  assert.ok(noEjercen.every((l) => !l.vigente));
  assert.ok(periodos().find((p) => p.id === PERIODO).vigente);
});

test("listado: primero la Cámara de Senadores y, dentro de cada cámara, por apellido", () => {
  const { enEjercicio } = todas();
  const camaras = enEjercicio.map((l) => l.camara);
  const primerDiputado = camaras.indexOf("CAMARA DE DIPUTADOS");
  assert.ok(primerDiputado > 0);
  assert.ok(camaras.slice(0, primerDiputado).every((c) => c === "CAMARA DE SENADORES"));
  assert.ok(camaras.slice(primerDiputado).every((c) => c === "CAMARA DE DIPUTADOS"));
  const apellidos = enEjercicio.slice(0, primerDiputado).map((l) => l.apellidos.normalize("NFD"));
  for (let i = 1; i < apellidos.length; i++) {
    assert.ok(apellidos[i - 1].localeCompare(apellidos[i], "es", { sensitivity: "base" }) <= 0, apellidos[i]);
  }
});

test("valores oficiales sin cambios, con el correo y el teléfono que publica la API", () => {
  const oficial = fuente(PERIODO, "legisladores.json").find((l) => l.idLegislador === 101405);
  const r = todas().enEjercicio.find((l) => l.id === 101405);
  assert.equal(r.nombre, `${oficial.nombres} ${oficial.apellidos}`);
  assert.equal(r.camara, "CAMARA DE DIPUTADOS");
  assert.equal(r.departamento, "ALTO PARANÁ");
  assert.equal(r.partido, oficial.partidoPolitico);
  assert.equal(r.bancada, oficial.bancada);
  assert.equal(r.urlSilpy, "https://silpy.congreso.gov.py/legislador/101405");
  const oficialONulo = (v) => (v && String(v).trim() ? v : null);
  assert.equal(r.correo, oficialONulo(oficial.emailParlamentario));
  assert.equal(r.telefono, oficialONulo(oficial.telefonoParlamentario));
});

test("filtros: cámara, partido, bancada, departamento y nombre sin acentos", () => {
  const { camaras, partidos, departamentos } = opcionesDelListado(PERIODO);
  assert.deepEqual(
    camaras.map((c) => c.etiqueta),
    ["CAMARA DE SENADORES", "CAMARA DE DIPUTADOS"],
  );
  assert.ok(partidos.some((p) => p.etiqueta === "Movimiento Conciencia Democrática Nacional (Yo Creo)"));
  assert.ok(departamentos.some((d) => d.etiqueta === "NACIONAL"));
  const senado = buscar({ camara: "camara-de-senadores" });
  assert.equal(senado.length, fuente(PERIODO, "legisladores.json").filter((l) => l.camaraParlamentario === "CAMARA DE SENADORES").length);
  assert.deepEqual(buscar({ departamento: "nacional" }), senado);
  assert.ok(buscar({ departamento: "alto-parana" }).includes("maria-rocio-abed-de-zacarias"));
  assert.deepEqual(buscar({ texto: "ovelar benitez" }), ["silvio-adalberto-ovelar-benitez"]);
  assert.deepEqual(buscar({ texto: "OVELAR BENÍTEZ" }), ["silvio-adalberto-ovelar-benitez"]);
  assert.ok(buscar({ partido: "movimiento-conciencia-democratica-nacional" }).length > 0);
  assert.deepEqual(buscar({ camara: "camara-de-diputados", texto: "ovelar benitez" }), []);
});

test("filtros: dos textos oficiales con el mismo slug no se fusionan", () => {
  for (const lista of Object.values(opcionesDelListado(PERIODO))) {
    assert.equal(new Set(lista.map((o) => o.valor)).size, lista.length);
  }
  const { bancadas } = opcionesDelListado(PERIODO);
  const pen = bancadas.filter((b) => b.etiqueta.startsWith("PARTIDO ENCUENTRO NACIONAL"));
  assert.deepEqual(
    pen.map((b) => b.valor),
    ["partido-encuentro-nacional-pen", "partido-encuentro-nacional-pen-2"],
  );
  for (const b of pen) {
    const elegidos = todas().enEjercicio.concat(todas().noEjercen).filter((l) => l.filtro.bancada === b.valor);
    assert.ok(elegidos.length > 0 && elegidos.every((l) => `${l.bancada}` === b.etiqueta), b.etiqueta);
  }
});

test("filtros en la dirección: se leen y se escriben sin los vacíos", () => {
  const f = leerFiltros(new URLSearchParams("q=abed&camara=camara-de-diputados"), nombres);
  assert.deepEqual(f, { texto: "abed", camara: "camara-de-diputados", partido: "", bancada: "", departamento: "" });
  assert.equal(escribirFiltros(f, nombres).toString(), "q=abed&camara=camara-de-diputados");
});

test("votos: el resumen coincide con un recuento hecho aparte en votos.csv", () => {
  const votaciones = new Map(fuente(PERIODO, "votaciones.json").map((v) => [v.idVotacion, v]));
  for (const slug of ["silvio-adalberto-ovelar-benitez", "maria-rocio-abed-de-zacarias"]) {
    const b = de(slug);
    const propios = fuente(PERIODO, "votos.csv").filter(
      (v) => Number(v.idLegislador) === b.id && votaciones.get(Number(v.idVotacion))._propio.idLeyes.length,
    );
    assert.equal(b.votos.total, propios.length);
    for (const t of b.votos.totales) {
      assert.equal(t.cantidad, propios.filter((v) => v.sentidoVotacion === t.categoria).length, `${slug} ${t.categoria}`);
      assert.equal(t.total, propios.length);
    }
    assert.equal(b.votos.ausencias.cantidad, propios.filter((v) => v.sentidoVotacion === "AUSENTE").length);
    assert.equal(b.votos.historial.length, propios.length);
    const fechas = b.votos.historial.map((h) => h.fechaIso);
    assert.deepEqual(fechas, [...fechas].sort().reverse());
  }
});

test("historial: cada voto enlaza a la votación dentro de la ficha de su ley", () => {
  const h = de("silvio-adalberto-ovelar-benitez").votos.historial.find((x) => x.id === 104218);
  assert.equal(h.fecha, "13/07/2023");
  assert.equal(h.sentido, "SI");
  assert.equal(h.etapa, "Tercer trámite constitucional");
  assert.deepEqual(h.leyes.map((l) => l.url), ["/leyes/7140/#votacion-104218"]);
});

test("quien ya no ejerce: ficha completa y cantidades cerradas", () => {
  const b = de("kattya-mabel-gonzalez-villanueva");
  assert.equal(b.vigente, false);
  assert.equal(b.periodoVigente, true);
  assert.equal(b.votos.total, 37);
  assert.equal(b.votos.ausencias.texto, "12 de 37 (32,4%)");
  assert.deepEqual(b.autoria.map((l) => l.numero), ["7256", "7239", "7190"]);
  assert.ok(todas().noEjercen.some((l) => l.slug === "kattya-mabel-gonzalez-villanueva"));
});

test("senador vitalicio: sin votos ni leyes, con su tipo oficial", () => {
  const b = de("juan-carlos-wasmosy-monti");
  assert.equal(b.tipo, "VITALICIO");
  assert.equal(b.votos.total, 0);
  assert.equal(b.autoria.length, 0);
});

test("autoría: solo leyes del período cuyo proyecto lo registra como autor", () => {
  const b = de("silvio-adalberto-ovelar-benitez");
  const numeros = b.autoria.map((l) => l.numero);
  assert.ok(numeros.includes("7158"));
  assert.equal(new Set(numeros).size, numeros.length);
  const fechas = b.autoria.map((l) => l.fechaIso);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test("foto: la copia propia cuando existe; sin foto si el Congreso no la publica", () => {
  assert.equal(de("silvio-adalberto-ovelar-benitez").foto, "/fotos/2023-2028/101339.jpg");
  const sinFoto = fuente(PERIODO, "legisladores.json").filter((l) => l.fotoURL.includes("noimage"));
  for (const l of sinFoto) assert.equal(de(l._propio.slug).foto, null);
});
