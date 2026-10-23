// Comprueba el sitio compilado (ejecutar después de npm run build).
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { leyes } from "../../src/lib/catalogo.js";
import { archivosDeDatos, estado } from "../../src/lib/datos.js";
import { detalleDeRegistro } from "../../src/lib/ficha.js";
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
