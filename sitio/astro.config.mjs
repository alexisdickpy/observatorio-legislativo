// Configuración de Astro: sitio 100 % estático (ver docs/decisiones/0001-arquitectura.md).
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://congreso.alexisdick.com",
  output: "static",
  trailingSlash: "always",
  // Conserva los espacios entre texto y etiquetas en distintas líneas (si no, se pegan palabras).
  compressHTML: false,
  build: { format: "directory" },
});
