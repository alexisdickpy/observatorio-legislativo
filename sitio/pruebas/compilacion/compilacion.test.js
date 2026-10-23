// Comprueba el sitio compilado (ejecutar después de npm run build).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { leyes } from "../../src/lib/catalogo.js";
import { archivosDeDatos, estado } from "../../src/lib/datos.js";
import * as rutas from "../../src/lib/rutas.js";

const dist = resolve(process.cwd(), "dist");
const pagina = (url) => join(dist, decodeURIComponent(url), "index.html");
const leer = (url) => readFileSync(pagina(url), "utf-8");

test("una ficha por número de ley", () => {
  for (const ley of leyes()) assert.ok(existsSync(pagina(ley.url)), `Falta la ficha ${ley.url}`);
});

test("páginas fijas", () => {
  for (const url of [rutas.inicio(), rutas.leyes(), rutas.buscar(), rutas.datosAbiertos()]) {
    assert.ok(existsSync(pagina(url)), `Falta ${url}`);
  }
});

test("el catálogo lista todas las leyes", () => {
  const html = leer(rutas.leyes());
  for (const ley of leyes()) assert.ok(html.includes(`data-numero="${ley.numero}"`), `Falta ${ley.numero}`);
});

test("cada página tiene la cita de la fuente y la fecha de actualización", () => {
  const cita = estado().fuente.cita;
  for (const url of [rutas.inicio(), rutas.leyes(), rutas.ley(leyes()[0].numero), rutas.datosAbiertos()]) {
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
