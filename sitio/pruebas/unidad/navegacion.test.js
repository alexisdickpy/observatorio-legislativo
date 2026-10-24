// Pruebas del menú principal y de la vista previa de análisis de la portada (lib/navegacion.js y
// lib/portada.js).
import assert from "node:assert/strict";
import { test } from "node:test";

import { coincidencia } from "../../src/lib/coincidencia.js";
import { comparativa } from "../../src/lib/legisladores.js";
import { entradaActual, menuPrincipal, vistasDeAnalisis } from "../../src/lib/navegacion.js";
import { barrasDeReferencia, paresConPorcentaje, vistaPrevia } from "../../src/lib/portada.js";
import * as rutas from "../../src/lib/rutas.js";

const PERIODO = "2023-2028";

test("el menú tiene una entrada por cada vista de análisis, con direcciones de lib/rutas.js", () => {
  const urls = menuPrincipal().map((e) => e.url);
  for (const v of vistasDeAnalisis()) assert.ok(urls.includes(v.url), `Falta ${v.url} en el menú`);
  assert.deepEqual(
    menuPrincipal().map((e) => e.texto),
    ["Leyes", "Legisladores", "Partidos", "Rankings", "Buscar", "Datos abiertos"],
  );
  assert.ok(urls.includes(rutas.coincidencia()) && urls.includes(rutas.votacionesNominales()));
  assert.equal(new Set(urls).size, urls.length, "Direcciones repetidas en el menú");
});

test("la entrada actual es la de ruta más larga que contiene la dirección", () => {
  const menu = menuPrincipal();
  assert.equal(entradaActual(menu, rutas.votacionesNominales()).texto, "Rankings");
  assert.equal(entradaActual(menu, rutas.legisladores()).texto, "Legisladores");
  assert.equal(entradaActual(menu, rutas.legislador("alguien")).texto, "Legisladores");
  assert.equal(entradaActual(menu, rutas.coincidencia()).texto, "Partidos");
  assert.equal(entradaActual(menu, rutas.inicio()), undefined);
});

test("pares de partidos con porcentaje, de mayor a menor, sin la diagonal ni los repetidos", () => {
  const celda = (cantidad, total) => ({ cantidad, total, porcentaje: cantidad / total, suficiente: total >= 20 });
  const cuadro = {
    filas: [
      { nombre: "A", celdas: [null, celda(18, 20), celda(30, 40)] },
      { nombre: "B", celdas: [celda(18, 20), null, celda(5, 10)] },
      { nombre: "C", celdas: [celda(30, 40), celda(5, 10), null] },
    ],
  };
  const pares = paresConPorcentaje(cuadro);
  assert.deepEqual(
    pares.map((p) => `${p.a}-${p.b}`),
    ["A-B", "A-C"],
  );
});

test("barras del gráfico: coincidencia con el partido de la primera fila, primero las que tienen porcentaje", () => {
  const celda = (cantidad, total) => ({ cantidad, total, porcentaje: cantidad / total, suficiente: total >= 20 });
  const cuadro = {
    filas: [
      { nombre: "A", celdas: [null, celda(5, 10), celda(30, 40), celda(18, 20), celda(0, 0)] },
      { nombre: "B", celdas: [] },
      { nombre: "C", celdas: [] },
      { nombre: "D", celdas: [] },
      { nombre: "E", celdas: [] },
    ],
  };
  const { referencia, barras } = barrasDeReferencia(cuadro);
  assert.equal(referencia, "A");
  assert.deepEqual(
    barras.map((b) => b.nombre),
    ["D", "C", "B"],
  );
  assert.deepEqual(barrasDeReferencia({ filas: [] }), { referencia: null, barras: [] });
});

test("vista previa por cámara, con las mismas cifras que las páginas de cada vista", () => {
  const previa = vistaPrevia(PERIODO);
  const c = coincidencia(PERIODO);
  assert.equal(previa.coincidencia.length, c.cuadros.length);
  for (const p of previa.coincidencia) {
    assert.equal(p.votaciones, c.camaras.find((x) => x.camara === p.camara).votaciones);
    assert.ok(p.mayor && p.menor, `Sin pares en ${p.camara}`);
    assert.ok(p.mayor.porcentaje >= p.menor.porcentaje);
    assert.ok(p.mayor.suficiente && p.menor.suficiente);
  }
  const comp = comparativa(PERIODO);
  assert.deepEqual(
    previa.votacionesNominales.map((x) => x.legisladores),
    comp.camaras.map((x) => x.filas.length),
  );
  for (const x of comp.camaras) {
    // Ningún legislador figura en más votaciones nominales que las de su cámara, y alguno figura en todas o casi.
    const maximo = Math.max(...x.filas.map((f) => f.ausencias.total));
    assert.ok(maximo <= x.votaciones && maximo > 0, `${x.camara}, ${maximo} de ${x.votaciones}`);
  }
});
