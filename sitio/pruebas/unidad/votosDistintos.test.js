// Pruebas del cuadro de legisladores con más votos distintos a la mayoría de su partido
// (lib/votosDistintos.js): orden, mínimo de votaciones comparables, empates y quienes quedan fuera.
import assert from "node:assert/strict";
import { test } from "node:test";

import { proporcion } from "../../src/lib/ficha.js";
import { comparativa } from "../../src/lib/legisladores.js";
import { CANTIDAD_CUADRO, MINIMO_COMPARABLES, cuadroDeCamara, votosDistintosAlPartido } from "../../src/lib/votosDistintos.js";

const PERIODO = "2023-2028";

/** Fila sintética de la vista comparativa, solo con lo que usa el cuadro. */
const fila = (slug, cantidad, total, grupo = "Partido A") => ({ slug, mayoriaPartido: { grupo, ...proporcion(cantidad, total) } });

test("de mayor a menor porcentaje, solo quienes alcanzan el mínimo y hasta la cantidad pedida", () => {
  const filas = [fila("a", 10, 100), fila("b", 30, 60), fila("c", 9, 9), fila("d", 1, 50), fila("e", 20, 100)];
  const r = cuadroDeCamara(filas, { minimo: 50, cantidad: 3 });
  assert.deepEqual(
    r.filas.map((f) => f.slug),
    ["b", "e", "a"],
  );
  assert.equal(r.bajoMinimo, 1, "c tiene 9 votaciones comparables");
  assert.equal(cuadroDeCamara(filas, { minimo: 50, cantidad: 10 }).filas.length, 4);
});

test("el mínimo es inclusivo y por defecto vale MINIMO_COMPARABLES", () => {
  const filas = [fila("justo", 1, MINIMO_COMPARABLES), fila("debajo", 40, MINIMO_COMPARABLES - 1)];
  const r = cuadroDeCamara(filas);
  assert.deepEqual(
    r.filas.map((f) => f.slug),
    ["justo"],
  );
  assert.equal(r.bajoMinimo, 1);
});

test("empates: a igual porcentaje, primero el de más votaciones comparables y después el orden de entrada", () => {
  const filas = [fila("x", 10, 100), fila("y", 20, 200), fila("z", 10, 100), fila("w", 5, 50)];
  assert.deepEqual(
    cuadroDeCamara(filas).filas.map((f) => f.slug),
    ["y", "x", "z", "w"],
  );
});

test("quienes no tienen votaciones comparables o partido registrado quedan fuera y se informan aparte", () => {
  const filas = [fila("solo", 0, 0, "Partido Único"), fila("sin", 0, 0, null), fila("a", 10, 100)];
  const r = cuadroDeCamara(filas);
  assert.deepEqual(
    r.filas.map((f) => f.slug),
    ["a"],
  );
  assert.deepEqual(
    r.sinComparables.map((f) => f.slug),
    ["solo"],
  );
  assert.equal(r.sinPartido, 1);
  assert.equal(r.bajoMinimo, 0);
});

test("período 2023-2028: mismas cifras que la vista comparativa y nadie se pierde", () => {
  const cuadro = votosDistintosAlPartido(PERIODO);
  const comp = comparativa(PERIODO);
  assert.equal(cuadro.minimo, MINIMO_COMPARABLES);
  assert.deepEqual(
    cuadro.camaras.map((c) => c.camara),
    comp.camaras.map((c) => c.camara),
  );
  for (const [i, c] of cuadro.camaras.entries()) {
    const todas = comp.camaras[i].filas;
    assert.equal(c.filas.length, CANTIDAD_CUADRO, c.camara);
    for (const f of c.filas) {
      assert.ok(todas.includes(f), `${f.slug} no es una fila de la vista comparativa`);
      assert.ok(f.mayoriaPartido.total >= MINIMO_COMPARABLES);
    }
    for (let n = 1; n < c.filas.length; n++) assert.ok(c.filas[n - 1].mayoriaPartido.porcentaje >= c.filas[n].mayoriaPartido.porcentaje);
    // El último del cuadro tiene un porcentaje igual o mayor que cualquiera que alcanza el mínimo y no entra.
    const ultimo = c.filas.at(-1).mayoriaPartido.porcentaje;
    for (const f of todas) if (!c.filas.includes(f) && f.mayoriaPartido.total >= MINIMO_COMPARABLES) assert.ok(f.mayoriaPartido.porcentaje <= ultimo, f.slug);
    // Cada legislador de la cámara está en el cuadro, alcanza el mínimo, está bajo el mínimo, sin comparables o sin partido.
    const alcanzan = todas.filter((f) => f.mayoriaPartido.grupo && f.mayoriaPartido.total >= MINIMO_COMPARABLES).length;
    assert.equal(alcanzan + c.bajoMinimo + c.sinComparables.length + c.sinPartido, todas.length, c.camara);
    for (const f of c.sinComparables) assert.ok(f.mayoriaPartido.unico > 0 && f.mayoriaPartido.empates === 0, f.slug);
    assert.ok(c.sinComparables.length > 0, `${c.camara} sin legisladores únicos de su partido`);
  }
});
