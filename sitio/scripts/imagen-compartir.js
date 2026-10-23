// Genera public/compartir.png, la imagen general de la vista previa al compartir (1200 × 630).
// Provisional hasta el diseño de la Fase 4 (#14). Los colores salen de src/estilos/tokens.css.
// No corre en cada compilación (el servidor de compilación puede no tener las mismas tipografías):
// se ejecuta a mano con `node scripts/imagen-compartir.js` y el resultado se sube al repositorio.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { sitio } from "../src/lib/rutas.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(resolve(raiz, "src", "estilos", "tokens.css"), "utf-8");
const token = (nombre) => tokens.match(new RegExp(`--${nombre}:\\s*([^;]+);`))[1].trim();

const acento = token("color-acento");
const sobreAcento = token("color-sobre-acento");
const fuente = "Segoe UI, Arial, sans-serif";

// El mismo dibujo que public/favicon.svg, ampliado.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${acento}"/>
  <g transform="translate(47 130) scale(7)" stroke="${sobreAcento}" stroke-width="2" fill="none" stroke-linejoin="round">
    <path d="M8 24h16M10 22V13m4 9v-9m4 9v-9m4 9v-9M7 12l9-5 9 5z"/>
  </g>
  <text x="96" y="420" fill="${sobreAcento}" font-family="${fuente}" font-size="76" font-weight="700">Observatorio Legislativo</text>
  <text x="96" y="490" fill="${sobreAcento}" font-family="${fuente}" font-size="34">Leyes, votaciones y legisladores del Congreso Nacional del Paraguay</text>
  <text x="96" y="566" fill="${sobreAcento}" font-family="${fuente}" font-size="28" opacity="0.85">${new URL(sitio).host}</text>
</svg>`;

const destino = resolve(raiz, "public", "compartir.png");
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(destino);
console.log(`Imagen para compartir -> ${destino}`);
