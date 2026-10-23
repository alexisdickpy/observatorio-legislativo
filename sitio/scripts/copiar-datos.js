// Copia datos/ del repositorio a public/datos/ para servirlo en /datos/… con las mismas rutas.
// public/datos/ no se sube al repositorio: se regenera en cada compilación.
import { cpSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origen = resolve(raiz, "..", "datos");
const destino = resolve(raiz, "public", "datos");

rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, { recursive: true });
console.log(`Datos copiados: ${origen} -> ${destino}`);
