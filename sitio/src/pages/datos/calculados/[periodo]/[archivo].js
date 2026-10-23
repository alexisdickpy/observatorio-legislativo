// Archivos calculados por este proyecto (lib/calculados.js), servidos para descargar desde la página
// de datos abiertos.
import { archivosCalculados } from "../../../../lib/calculados.js";

const TIPOS = { CSV: "text/csv; charset=utf-8", JSON: "application/json; charset=utf-8" };

export function getStaticPaths() {
  return archivosCalculados().map((a) => ({
    params: { periodo: a.periodo, archivo: a.url.split("/").pop() },
    props: { archivo: a },
  }));
}

export function GET({ props }) {
  const { archivo } = props;
  return new Response(archivo.contenido, { headers: { "Content-Type": TIPOS[archivo.formato] } });
}
