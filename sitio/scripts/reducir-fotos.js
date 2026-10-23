// Genera public/fotos/{período}/{idLegislador}.jpg: las fotos de datos/fotos/ reducidas a
// LADO × LADO píxeles para las fichas. Las originales del Congreso pesan hasta ~500 KB; las
// reducidas, unos 10 KB. Las originales se siguen sirviendo sin cambios en /datos/fotos/.
// public/fotos/ no se sube al repositorio: se regenera en cada compilación.
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// El doble del tamaño en que se muestran (--tamano-foto-legislador), para pantallas de alta densidad.
const LADO = 320;

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origen = resolve(raiz, "..", "datos", "fotos");
const destino = resolve(raiz, "public", "fotos");

rmSync(destino, { recursive: true, force: true });
let cantidad = 0;
const periodos = existsSync(origen) ? readdirSync(origen, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
for (const periodo of periodos) {
  mkdirSync(join(destino, periodo.name), { recursive: true });
  for (const archivo of readdirSync(join(origen, periodo.name)).filter((a) => a.endsWith(".jpg"))) {
    await sharp(join(origen, periodo.name, archivo))
      .resize(LADO, LADO, { fit: "cover", position: "top" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(join(destino, periodo.name, archivo));
    cantidad++;
  }
}
console.log(`Fotos reducidas: ${cantidad} -> ${destino}`);
