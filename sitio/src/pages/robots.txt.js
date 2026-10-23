// robots.txt: todos los rastreadores pueden leer el sitio, también los de inteligencia artificial
// (los datos son CC BY 4.0). Solo se excluyen los archivos internos del buscador.
import * as rutas from "../lib/rutas.js";

export function GET() {
  const texto = `User-agent: *
Disallow: ${rutas.archivosBuscador()}

Sitemap: ${rutas.absoluta(rutas.sitemap())}
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
