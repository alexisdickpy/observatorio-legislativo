// Pruebas de la preparación de las fichas de ley con casos reales de datos/.
import assert from "node:assert/strict";
import { test } from "node:test";

import { leyes } from "../../src/lib/catalogo.js";
import { interpretarCsv } from "../../src/lib/datos.js";
import { agruparPorCamara, detalleDeRegistro, ordenarCategorias, proporcion } from "../../src/lib/ficha.js";

const detalles = (numero) => leyes().find((l) => l.numero === numero).registros.map(detalleDeRegistro);
const todos = () => leyes().flatMap((l) => l.registros.map((r) => ({ numero: l.numero, d: detalleDeRegistro(r) })));
const OFICIALES = ["SI", "NO", "ABSTENCIÓN/BLANCO", "NO VOTA", "AUSENTE"];

test("CSV con comillas, comillas dobles, BOM y fin de línea de Windows", () => {
  assert.deepEqual(interpretarCsv('﻿a,b\r\n"x, ""y""",2\r\n,\n'), [
    { a: 'x, "y"', b: "2" },
    { a: "", b: "" },
  ]);
});

test("porcentajes con el denominador escrito", () => {
  assert.equal(proporcion(12, 30).texto, "12 de 30 (40%)");
  assert.equal(proporcion(42, 49).texto, "42 de 49 (85,7%)");
  assert.equal(proporcion(0, 0).texto, "0 de 0 (0%)");
});

test("categorías oficiales sin fusionar: las cinco siempre y las MOCIÓN en el medio", () => {
  assert.deepEqual(ordenarCategorias(["AUSENTE", "MOCIÓN 2", "SI", "MOCIÓN 1"]), [
    "SI",
    "NO",
    "ABSTENCIÓN/BLANCO",
    "MOCIÓN 1",
    "MOCIÓN 2",
    "NO VOTA",
    "AUSENTE",
  ]);
});

test("una ficha por registro, sin errores, con los totales iguales a los votos registrados", () => {
  for (const { numero, d } of todos()) {
    for (const v of d.votaciones.indice) {
      const suma = v.totales.reduce((s, t) => s + t.cantidad, 0);
      assert.equal(suma, v.registrados, `Ley ${numero}, votación ${v.id}`);
      for (const c of OFICIALES) assert.ok(v.categorias.includes(c));
      for (const grupos of [v.porPartido, v.porBancada]) {
        assert.equal(grupos.reduce((s, g) => s + g.total, 0), v.registrados);
        for (const g of grupos) assert.equal(g.celdas.reduce((s, c) => s + c.cantidad, 0), g.total);
      }
    }
  }
});

test("ley 7235: iniciativa del Poder Ejecutivo, sin autores y diez votaciones por cámara y fecha", () => {
  const [d] = detalles("7235");
  assert.equal(d.iniciativa, "PODER EJECUTIVO");
  assert.deepEqual(d.ministerios, ["MINISTERIO DE ECONOMÍA Y FINANZAS"]);
  assert.deepEqual(d.autores, []);
  assert.equal(d.votaciones.cantidad, 10);
  // Primero la cámara que votó más recientemente; dentro, de la más reciente a la más antigua.
  assert.deepEqual(
    d.votaciones.camaras.map((c) => [c.camara, c.votaciones.length]),
    [
      ["CAMARA DE DIPUTADOS", 1],
      ["CAMARA DE SENADORES", 9],
    ],
  );
  const fechas = d.votaciones.indice.map((v) => v.fechaIso);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
  const diputados = d.votaciones.camaras[0].votaciones[0];
  assert.equal(diputados.id, 104525);
  assert.equal(diputados.etapa, "Segundo trámite constitucional");
  assert.equal(diputados.resultado, "APROBADO");
  assert.equal(diputados.registrados, 80);
  assert.equal(diputados.totales.find((t) => t.categoria === "SI").texto, "42 de 80 (52,5%)");
  const anr = diputados.porPartido.find((g) => g.nombre === "Asociación Nacional Republicana ANR");
  assert.equal(anr.celdas[0].texto, "42 de 49 (85,7%)");
});

test("ley 7363: las MOCIÓN se cuentan desde los votos individuales y se señalan como recuento propio", () => {
  const [d] = detalles("7363");
  const v = d.votaciones.indice.find((x) => x.id === 105935);
  assert.ok(v.observacion.startsWith("MOCIÓN 1: Texto Diputados"));
  const t = Object.fromEntries(v.totales.map((x) => [x.categoria, [x.cantidad, x.recuentoPropio]]));
  assert.deepEqual(t["MOCIÓN 1"], [31, true]);
  assert.deepEqual(t["MOCIÓN 3"], [10, true]);
  assert.deepEqual(t["ABSTENCIÓN/BLANCO"], [2, false]);
  assert.deepEqual(t.SI, [0, false]);
  assert.ok(v.hayRecuentoPropio);
});

test("ley 7076: autores de otra legislatura con su partido, bancada, cámara y legislatura", () => {
  const [d] = detalles("7076");
  assert.equal(d.iniciativa, "PARLAMENTARIA");
  assert.equal(d.autores.length, 4);
  for (const a of d.autores) {
    assert.equal(a.delPeriodo, false);
    assert.equal(a.legislatura, "2018-2023");
    assert.equal(a.camara, "CAMARA DE SENADORES");
    assert.ok(a.partido && a.bancada && a.url.startsWith("https://silpy.congreso.gov.py/legislador/"));
  }
  assert.deepEqual(
    d.votaciones.otrosPeriodos.map((o) => o.url),
    ["https://silpy.congreso.gov.py/votacion/104044", "https://silpy.congreso.gov.py/votacion/104153"],
  );
});

test("leyes sin votación nominal y notas propias", () => {
  const [sin] = detalles("7139");
  assert.equal(sin.votaciones.cantidad, 0);
  assert.deepEqual(sin.votaciones.camaras, []);
  const conNota = detalles("7140")[0].votaciones.indice.find((v) => v.id === 104218);
  assert.deepEqual(conNota.notas, ["Tiene 44 votos individuales y la cámara tiene 45 miembros con voto."]);
  assert.deepEqual(detalles("7504")[0].notas, ["La API no devolvió adjuntos para el proyecto 139001."]);
});

test("ley 7322: cada registro tiene sus propias votaciones", () => {
  const ds = detalles("7322");
  assert.equal(ds.length, 4);
  const ids = ds.flatMap((d) => d.votaciones.indice.map((v) => v.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("agrupar por cámara con la misma fecha: la de mayor id primero", () => {
  const v = (id, fechaIso, camara) => ({ id, fechaIso, camara });
  const r = agruparPorCamara([v(1, "2024-01-01", "A"), v(3, "2024-01-01", "B"), v(2, "2024-01-01", "A")]);
  assert.deepEqual(
    r.map((c) => [c.camara, c.votaciones.map((x) => x.id)]),
    [
      ["B", [3]],
      ["A", [2, 1]],
    ],
  );
});
