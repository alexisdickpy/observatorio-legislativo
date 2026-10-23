// Comprueba el sitio compilado (ejecutar después de npm run build).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { leyes } from "../../src/lib/catalogo.js";
import { archivosDeDatos, estado } from "../../src/lib/datos.js";
import { detalleDeRegistro } from "../../src/lib/ficha.js";
import { ficha, legisladores, listado } from "../../src/lib/legisladores.js";
import { observacionesDeLosDatos } from "../../src/lib/metodologia.js";
import * as rutas from "../../src/lib/rutas.js";

const dist = resolve(process.cwd(), "dist");
const pagina = (url) => join(dist, decodeURIComponent(url), "index.html");
const leer = (url) => readFileSync(pagina(url), "utf-8");
/** HTML con los espacios y saltos de línea seguidos reducidos a uno (compressHTML está desactivado). */
const texto = (url) => leer(url).replace(/\s+/g, " ");

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
  for (const url of [rutas.inicio(), rutas.leyes(), rutas.legisladores(), rutas.buscar(), rutas.datosAbiertos(), rutas.metodologia(), rutas.privacidad()]) {
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
    for (const b of ficha(persona).bloques) {
      if (b.urlSilpy) assert.ok(html.includes(`href="${b.urlSilpy}"`));
      if (b.correo) assert.ok(html.includes(`href="mailto:${b.correo}"`), `Falta el correo en ${persona.url}`);
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

/** Todas las páginas HTML del sitio compilado, como URL. */
function todasLasPaginas(carpeta = dist, base = "/") {
  const urls = [];
  for (const e of readdirSync(carpeta, { withFileTypes: true })) {
    if (e.isDirectory() && !["fotos", "pagefind", "_astro"].includes(e.name)) {
      urls.push(...todasLasPaginas(join(carpeta, e.name), `${base}${e.name}/`));
    } else if (e.name === "index.html") urls.push(base);
  }
  return urls;
}

test("todas las páginas tienen el pie común: aviso, enlaces, licencias y firma", () => {
  const urls = todasLasPaginas();
  assert.ok(urls.length > leyes().length + legisladores().length);
  for (const url of urls) {
    const html = texto(url);
    for (const buscado of [
      "sin vínculo con el Congreso",
      "este sitio no corrige los valores oficiales",
      "Desarrollado por Alexis Dick con asistencia de IA.",
      `href="${rutas.metodologia()}"`,
      `href="${rutas.privacidad()}"`,
      `href="${rutas.codigoFuente()}"`,
      `href="${rutas.licenciaDatos()}"`,
      `href="${rutas.licenciaCodigo()}"`,
    ]) {
      assert.ok(html.includes(buscado), `Falta «${buscado}» en ${url}`);
    }
    assert.ok(!html.includes("prevalece"), `Queda el aviso anterior en ${url}`);
  }
});

test("la metodología tiene las secciones que enlazan las fichas y todas las observaciones sobre los datos", () => {
  const html = leer(rutas.metodologia());
  for (const ancla of Object.values(rutas.anclasMetodologia)) assert.ok(html.includes(`id="${ancla}"`), `Falta #${ancla}`);
  assert.ok(texto(rutas.metodologia()).includes("ausencias en votaciones nominales"));
  const { grupos } = observacionesDeLosDatos();
  for (const g of grupos) {
    assert.ok(html.includes(`id="${g.ancla}"`), `Falta el grupo ${g.tipo}`);
    for (const c of g.casos) {
      if (c.sitio) assert.ok(html.includes(`href="${c.sitio.url}"`), `Falta ${c.sitio.url}`);
      if (c.oficial) assert.ok(html.includes(`href="${c.oficial.url}"`), `Falta ${c.oficial.url}`);
    }
  }
});

test("la privacidad dice que no se recogen datos personales ni se usan cookies", () => {
  const html = texto(rutas.privacidad());
  assert.ok(html.includes("no recoge datos personales"));
  assert.ok(html.includes("sin cookies") || html.includes("no usan cookies"));
  assert.ok(html.includes("No tiene vínculo con el Congreso Nacional ni cuenta con su"));
});

test("las fichas enlazan a la metodología", () => {
  const afiliacion = `href="${rutas.metodologia(rutas.anclasMetodologia.afiliacion)}"`;
  const resumen = `href="${rutas.metodologia(rutas.anclasMetodologia.votosLegislador)}"`;
  for (const persona of legisladores()) {
    const html = leer(persona.url);
    assert.ok(html.includes(afiliacion), `Falta el enlace a la metodología en ${persona.url}`);
    if (ficha(persona).bloques.some((b) => b.votos.total > 0)) assert.ok(html.includes(resumen), persona.url);
  }
  for (const ley of leyes()) {
    const conVotaciones = ley.registros.some((r) => detalleDeRegistro(r).votaciones.cantidad > 0);
    if (conVotaciones) assert.ok(leer(ley.url).includes(afiliacion), `Falta el enlace a la metodología en ${ley.url}`);
  }
});

// --- Buscadores y vista previa al compartir (#10) ---

/** Valor de la primera coincidencia, con las entidades HTML que usa Astro ya convertidas. */
const etiqueta = (html, patron) =>
  html.match(patron)?.[1]?.replaceAll("&#39;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const metaPropiedad = (html, propiedad) => etiqueta(html, new RegExp(`<meta property="${propiedad}" content="([^"]*)"`));
const datosEstructurados = (url) => JSON.parse(etiqueta(leer(url), /<script type="application\/ld\+json">(.*?)<\/script>/s));
const archivoDe = (direccion) => join(dist, decodeURIComponent(new URL(direccion).pathname));

test("cada página tiene título y descripción únicos, URL canónica e imagen para compartir", () => {
  const titulos = new Map();
  const descripciones = new Map();
  for (const url of todasLasPaginas()) {
    const html = leer(url);
    const titulo = etiqueta(html, /<title>([^<]*)<\/title>/);
    const descripcion = etiqueta(html, /<meta name="description" content="([^"]*)"/);
    assert.ok(titulo && descripcion, `Faltan título o descripción en ${url}`);
    assert.ok(!titulos.has(titulo), `Título repetido en ${url} y ${titulos.get(titulo)}`);
    assert.ok(!descripciones.has(descripcion), `Descripción repetida en ${url} y ${descripciones.get(descripcion)}`);
    titulos.set(titulo, url);
    descripciones.set(descripcion, url);
    assert.equal(etiqueta(html, /<link rel="canonical" href="([^"]*)"/), rutas.absoluta(url));
    assert.equal(metaPropiedad(html, "og:title"), titulo);
    assert.equal(metaPropiedad(html, "og:url"), rutas.absoluta(url));
    const imagen = metaPropiedad(html, "og:image");
    assert.ok(imagen?.startsWith(rutas.sitio) && existsSync(archivoDe(imagen)), `Imagen inexistente en ${url}`);
  }
});

test("la foto oficial como vista previa de cada legislador que la tiene", () => {
  for (const persona of legisladores()) {
    const foto = ficha(persona).bloques[0].foto;
    const esperada = rutas.absoluta(foto ?? rutas.imagenCompartir());
    assert.equal(metaPropiedad(leer(persona.url), "og:image"), esperada, persona.url);
  }
});

test("datos estructurados válidos en leyes, legisladores, datos abiertos e inicio", () => {
  for (const ley of leyes()) assert.equal(datosEstructurados(ley.url)["@type"], "Legislation", ley.url);
  for (const persona of legisladores()) assert.equal(datosEstructurados(persona.url)["@type"], "Person", persona.url);
  const conjunto = datosEstructurados(rutas.datosAbiertos());
  assert.equal(conjunto["@type"], "Dataset");
  for (const a of conjunto.distribution) assert.ok(existsSync(archivoDe(a.contentUrl)), a.contentUrl);
  assert.equal(datosEstructurados(rutas.inicio())["@type"], "WebSite");
});

test("sitemap.xml con todas las páginas indexables y robots.txt que lo anuncia", () => {
  const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf-8");
  const enSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paginas = todasLasPaginas().filter((u) => u !== rutas.buscar()).map(rutas.absoluta);
  assert.deepEqual([...enSitemap].sort(), [...paginas].sort());
  const robots = readFileSync(join(dist, "robots.txt"), "utf-8");
  assert.ok(robots.includes(`Sitemap: ${rutas.absoluta(rutas.sitemap())}`));
  assert.ok(robots.includes(`Disallow: ${rutas.archivosBuscador()}`));
  assert.ok(!/Disallow: \/\s*$/m.test(robots), "robots.txt no debe bloquear todo el sitio");
});

test("página 404 propia, fuera de los buscadores", () => {
  const html = readFileSync(join(dist, "404.html"), "utf-8");
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(!html.includes('rel="canonical"'));
});

test("sin herramientas de seguimiento con cookies", () => {
  for (const url of todasLasPaginas()) {
    const html = leer(url);
    for (const rastreador of ["googletagmanager", "google-analytics", "gtag(", "facebook.net", "hotjar"]) {
      assert.ok(!html.includes(rastreador), `${rastreador} en ${url}`);
    }
  }
});
