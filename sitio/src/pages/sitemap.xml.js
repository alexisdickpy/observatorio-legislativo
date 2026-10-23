// sitemap.xml: todas las páginas con contenido propio (lib/seo.js), con la fecha de la última
// modificación de los datos.
import { estado } from "../lib/datos.js";
import { direccionesDelSitemap } from "../lib/seo.js";

export function GET() {
  const fecha = estado().ultimaModificacion;
  const urls = direccionesDelSitemap()
    .map((url) => `  <url><loc>${url}</loc><lastmod>${fecha}</lastmod></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
