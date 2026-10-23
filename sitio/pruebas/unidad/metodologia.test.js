// Pruebas de la lista de observaciones sobre los datos de la metodología con las notas reales de datos/.
import assert from "node:assert/strict";
import { test } from "node:test";

import { notas } from "../../src/lib/datos.js";
import { indice } from "../../src/lib/ficha.js";
import { observacionesDeLosDatos } from "../../src/lib/metodologia.js";
import * as rutas from "../../src/lib/rutas.js";

test("cada nota figura una sola vez, en el grupo de su tipo", () => {
  const { total, grupos } = observacionesDeLosDatos();
  assert.equal(total, notas().length);
  assert.equal(grupos.flatMap((g) => g.casos).length, notas().length);
  assert.equal(new Set(grupos.map((g) => g.tipo)).size, grupos.length);
  for (const g of grupos) {
    const deEsteTipo = notas().filter((n) => n.tipo === g.tipo);
    assert.deepEqual(g.casos.map((c) => c.id), deEsteTipo.map((n) => n.id).sort((a, b) => a - b));
  }
});

test("los tipos conocidos tienen título y explicación propios; el ancla no repite", () => {
  const { grupos } = observacionesDeLosDatos();
  for (const g of grupos) {
    assert.notEqual(g.titulo, g.tipo, `Falta el título de ${g.tipo}`);
    assert.ok(g.explicacion, `Falta la explicación de ${g.tipo}`);
  }
  assert.equal(new Set(grupos.map((g) => g.ancla)).size, grupos.length);
});

test("menos votos que miembros: no se interpreta la causa", () => {
  const g = observacionesDeLosDatos().grupos.find((x) => x.tipo === "menos_votos_que_miembros");
  assert.ok(g, "Las notas de datos/ incluyen este tipo");
  assert.match(g.explicacion, /no indica la causa/);
});

test("cada caso enlaza a su página en el sitio y a la fuente oficial", () => {
  for (const g of observacionesDeLosDatos().grupos) {
    for (const c of g.casos) {
      const nota = notas().find((n) => n.tipo === g.tipo && n.id === c.id);
      const i = indice(nota.periodoLegislativo);
      if (nota.entidad === "votacion") {
        // Solo las votaciones enlazadas con una ley del período tienen página en el sitio.
        const ley = i.leyes.get((i.votaciones.get(c.id)._propio.idLeyes ?? [])[0]);
        if (ley) assert.equal(c.sitio.url, rutas.votacionEnLey(ley._propio.numeroLey, c.id));
        else assert.ok(c.sitio === null && c.fueraDelSitio);
        assert.match(c.titulo, /^Votación del /);
        assert.ok(c.oficial.url.startsWith("https://"));
      }
      if (nota.entidad === "ley") {
        assert.equal(c.sitio.url, rutas.ley(i.leyes.get(c.id)._propio.numeroLey));
        assert.ok(c.oficial?.url.startsWith("https://"), `Falta el enlace oficial de la ley ${c.id}`);
      }
    }
  }
});

test("direcciones de la metodología y de privacidad", () => {
  assert.equal(rutas.metodologia(), "/metodologia/");
  assert.equal(rutas.metodologia(rutas.anclasMetodologia.observaciones), "/metodologia/#observaciones-sobre-los-datos");
  assert.equal(rutas.privacidad(), "/privacidad/");
});
