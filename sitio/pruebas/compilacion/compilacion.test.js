// Comprueba el sitio compilado (ejecutar después de npm run build).
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { leyes } from "../../src/lib/catalogo.js";
import { archivosDeDatos, estado } from "../../src/lib/datos.js";
import { detalleDeRegistro } from "../../src/lib/ficha.js";
import { ficha, legisladores, listado } from "../../src/lib/legisladores.js";
import * as rutas from "../../src/lib/rutas.js";

const dist = resolve(process.cwd(), "dist");
const pagina = (url) => join(dist, decodeURIComponent(url), "index.html");
const leer = (url) => readFileSync(pagina(url), "utf-8");

test("una ficha por número de ley", () => {
  for (const ley of leyes()) assert.ok(existsSync(pagina(ley.url)), `Falta la ficha ${ley.url}`);
});

test("cada ficha muestra autores, enlaces oficiales y todas sus votaciones", () => {
  for (const ley of leyes()) {
    const html = leer(ley.url);
    assert.ok(html.includes("Iniciativa y autores"), `Faltan los autores en ${ley.url}`);
    for (const registro of ley.registros) {
      if (registro.urlLey) assert.ok(html.includes(`href="${registro.urlLey}"`), `Falta el enlace a la ley en ${ley.url}`);
      if (registro.urlExpediente) assert.ok(html.includes(`href="${registro.urlExpediente}"`));
      const { votaciones } = detalleDeRegistro(registro);
      if (votaciones.cantidad === 0) assert.ok(html.includes("no tiene votaciones nominales registradas"));
      else assert.ok(html.includes("no necesariamente eran los vigentes"), `Falta el aviso de afiliación en ${ley.url}`);
      for (const v of votaciones.indice) {
        assert.ok(html.includes(`id="${v.ancla}"`) && html.includes(`href="#${v.ancla}"`), `Falta ${v.ancla} en ${ley.url}`);
      }
      for (const o of votaciones.otrosPeriodos) assert.ok(html.includes(`href="${o.url}"`));
    }
  }
});

test("tamaño razonable de las fichas", () => {
  for (const ley of leyes()) {
    const bytes = statSync(pagina(ley.url)).size;
    assert.ok(bytes < 1_000_000, `${ley.url} pesa ${bytes} bytes`);
  }
});

test("páginas fijas", () => {
  for (const url of [rutas.inicio(), rutas.leyes(), rutas.legisladores(), rutas.buscar(), rutas.datosAbiertos()]) {
    assert.ok(existsSync(pagina(url)), `Falta ${url}`);
  }
});

test("el catálogo lista todas las leyes", () => {
  const html = leer(rutas.leyes());
  for (const ley of leyes()) assert.ok(html.includes(`data-numero="${ley.numero}"`), `Falta ${ley.numero}`);
});

test("cada página tiene la cita de la fuente y la fecha de actualización", () => {
  const cita = estado().fuente.cita;
  const unLegislador = rutas.legislador(legisladores()[0].slug);
  for (const url of [rutas.inicio(), rutas.leyes(), rutas.ley(leyes()[0].numero), rutas.legisladores(), unLegislador, rutas.datosAbiertos()]) {
    const html = leer(url);
    assert.ok(html.includes(cita), `Falta la cita en ${url}`);
    assert.ok(html.includes(`datetime="${estado().ultimaComprobacion}"`), `Falta la fecha en ${url}`);
  }
});

test("índice de búsqueda generado", () => {
  assert.ok(existsSync(join(dist, "pagefind", "pagefind.js")));
});

test("datos/ servido en /datos/ con las mismas rutas", () => {
  const html = leer(rutas.datosAbiertos());
  for (const { ruta } of archivosDeDatos()) {
    assert.ok(existsSync(join(dist, "datos", ruta)), `Falta ${ruta}`);
    assert.ok(html.includes(`href="${rutas.archivoDatos(ruta)}"`), `La página de descargas no enlaza ${ruta}`);
  }
});

test("una ficha por legislador, con su historial enlazado a las fichas de ley", () => {
  for (const persona of legisladores()) {
    const html = leer(persona.url);
    assert.ok(html.includes("no necesariamente eran los vigentes"), `Falta el aviso de afiliación en ${persona.url}`);
    assert.ok(!/mailto:|tel:/.test(html), `Datos de contacto en ${persona.url}`);
    for (const b of ficha(persona).bloques) {
      if (b.urlSilpy) assert.ok(html.includes(`href="${b.urlSilpy}"`));
      if (b.foto) assert.ok(existsSync(join(dist, b.foto)), `Falta la foto ${b.foto}`);
      for (const l of b.autoria) assert.ok(html.includes(`href="${l.url}"`), `Falta la ley ${l.numero} en ${persona.url}`);
      for (const h of b.votos.historial) {
        for (const l of h.leyes) assert.ok(html.includes(`href="${l.url}"`), `Falta ${l.url} en ${persona.url}`);
      }
    }
    const bytes = statSync(pagina(persona.url)).size;
    assert.ok(bytes < 500_000, `${persona.url} pesa ${bytes} bytes`);
  }
});

test("cada enlace del historial lleva a una votación que existe en la ficha de la ley", () => {
  const anclas = new Map();
  for (const persona of legisladores()) {
    for (const h of ficha(persona).bloques.flatMap((b) => b.votos.historial)) {
      for (const l of h.leyes) {
        if (!anclas.has(l.numero)) anclas.set(l.numero, leer(rutas.ley(l.numero)));
        assert.ok(anclas.get(l.numero).includes(`id="${rutas.anclaVotacion(h.id)}"`), l.url);
      }
    }
  }
});

test("el listado incluye a todos los legisladores del período y las fichas de ley los enlazan", () => {
  const html = leer(rutas.legisladores());
  const { enEjercicio, noEjercen } = listado("2023-2028");
  for (const l of [...enEjercicio, ...noEjercen]) assert.ok(html.includes(`href="${l.url}"`), `Falta ${l.url}`);
  const ley = leer(rutas.ley("7140"));
  assert.ok(ley.includes(`href="${rutas.legislador("silvio-adalberto-ovelar-benitez")}"`));
});

test("fotos: la original en /datos/fotos/ y la reducida en /fotos/", () => {
  for (const persona of legisladores()) {
    for (const b of ficha(persona).bloques.filter((x) => x.foto)) {
      const original = join(dist, "datos", "fotos", b.periodo, `${b.id}.jpg`);
      assert.ok(existsSync(original), `Falta ${original}`);
      assert.ok(statSync(join(dist, b.foto)).size < 40_000, `${b.foto} no está reducida`);
    }
  }
});
