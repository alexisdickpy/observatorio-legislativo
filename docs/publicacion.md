# Publicación en Cloudflare Pages

El sitio se publica en `https://congreso.alexisdick.com` con Cloudflare Pages, conectado a este repositorio (decisión 6 de [`decisiones/0001-arquitectura.md`](decisiones/0001-arquitectura.md)). Este documento reúne la configuración y los pasos en el panel de Cloudflare, que se hacen una sola vez desde la cuenta dueña del dominio. No hace falta guardar ninguna clave de Cloudflare en GitHub.

## Configuración

| Opción | Valor |
|---|---|
| Nombre del proyecto | `observatorio-legislativo-py` (dirección secundaria `observatorio-legislativo-py.pages.dev`) |
| Rama de producción | `main` |
| Directorio raíz | `sitio` |
| Comando de compilación | `npm run build` |
| Directorio de salida | `dist` |
| Variable de entorno | `NODE_VERSION` = `24.21.0`, la misma de `sitio/.node-version` |
| Vistas previas | Activas para todas las ramas y PR |
| Dominio | `congreso.alexisdick.com` |
| Estadísticas | Cloudflare Web Analytics, activado desde el panel, para todos los visitantes |

Los datos no se suben aparte. La compilación copia `datos/` del repositorio (`npm run datos`), así que cada sincronización diaria que confirma cambios en `main` publica el sitio actualizado sola. Una compilación tarda unos minutos y genera unos 1.700 archivos.

**Si cambia la versión de Node.js**, hay que actualizarla en tres lugares: `sitio/.node-version`, `engines` de `sitio/package.json` y la variable `NODE_VERSION` del proyecto en Cloudflare.

### Vistas previas

Cada rama y cada PR del repositorio reciben su propia dirección de prueba (`…observatorio-legislativo-py.pages.dev`), que aparece como comentario o estado en el PR. Cloudflare les agrega la cabecera `X-Robots-Tag: noindex` para que los buscadores no las indexen. La dirección secundaria de producción sí es indexable, pero cada página declara como canónica la de `congreso.alexisdick.com`.

### Estadísticas

Cloudflare Web Analytics no usa cookies ni guarda la dirección IP. Cuenta visitas, páginas vistas, páginas más leídas, el sitio de procedencia, el país, el tipo de dispositivo, el navegador, el sistema y el tiempo de carga. Al revisarlas conviene activar el filtro que excluye robots. No cuenta personas únicas ni descargas de archivos de datos, porque esos archivos no son páginas. Los datos se conservan solo unos meses, así que conviene anotar un resumen mensual. La página de privacidad describe lo mismo (una prueba de compilación lo exige).

No se excluye a los visitantes de la Unión Europea, porque sin cookies ni datos personales no hace falta pedir consentimiento.

## Pasos en el panel de Cloudflare

Los nombres de los menús pueden variar un poco si Cloudflare cambia el panel.

### 1. Crear el proyecto conectado a GitHub

1. Entrar en [dash.cloudflare.com](https://dash.cloudflare.com) con la cuenta donde está `alexisdick.com`.
2. En el menú de la izquierda, abrir **Workers & Pages** (puede estar dentro de **Compute**).
3. Pulsar **Create application** (o **Create**). Si la pantalla ofrece crear un *Worker*, buscar la pestaña **Pages** o el enlace para Pages.
4. Elegir **Connect to Git** (o **Import an existing Git repository**) y luego **GitHub**.
5. Si es la primera vez, GitHub pide instalar la aplicación de Cloudflare. Conviene elegir **Only select repositories** y marcar solo `observatorio-legislativo-py`. Pulsar **Install & Authorize**.
   - Si la aplicación ya estaba instalada para otros repositorios, este no aparece en la lista. Pulsar el enlace **Cloudflare Pages** de la frase «configure repository access…», agregar `observatorio-legislativo-py` en **Repository access** → **Select repositories** sin quitar los demás, pulsar **Save** y recargar la página de Cloudflare.
6. De vuelta en Cloudflare, elegir el repositorio `observatorio-legislativo-py` y pulsar **Begin setup**.
7. Completar la pantalla **Set up builds and deployments** con la tabla de arriba.
   - **Project name**, `observatorio-legislativo-py`.
   - **Production branch**, `main`.
   - **Framework preset**, *None* (o *Astro*, y después corregir los campos).
   - **Build command**, `npm run build`.
   - **Build output directory**, `dist`.
   - **Root directory (advanced)** → **Path**, `sitio`.
   - **Environment variables (advanced)** → **Add variable**, nombre `NODE_VERSION` y valor `24.21.0`.
8. Pulsar **Save and Deploy** y esperar a que termine la primera compilación (unos minutos). Al final aparece la dirección `observatorio-legislativo-py.pages.dev`.

### 2. Agregar el dominio

1. Dentro del proyecto, abrir la pestaña **Custom domains** y pulsar **Set up a custom domain**.
2. Escribir `congreso.alexisdick.com` y pulsar **Continue**.
3. Como el DNS de `alexisdick.com` está en la misma cuenta, Cloudflare propone crear un único registro `CNAME` llamado `congreso` que apunta a `observatorio-legislativo-py.pages.dev`. Pulsar **Activate domain**.
4. Esperar a que el estado diga **Active**. El certificado HTTPS se emite solo, en minutos (a veces hasta una hora o dos).

No hay que tocar ningún otro registro DNS. Si en **DNS** → **Records** ya existiera un registro llamado `congreso`, hay que avisar antes de seguir.

### 3. Activar las estadísticas

1. Dentro del proyecto, abrir la pestaña **Metrics**.
2. En **Web Analytics**, pulsar **Enable**.
3. Cloudflare agrega su código de medición a partir de la siguiente publicación. Para que sea inmediato, ir a **Deployments**, abrir el menú (⋯) de la última publicación de producción y elegir **Retry deployment**.
4. Las estadísticas se ven en **Web Analytics** del menú izquierdo (puede estar dentro de **Analytics & Logs**).

### 4. Comprobar las vistas previas

En **Settings** → **Builds** (o **Builds & deployments**) → **Branch control**, confirmar que **Production branch** es `main` y que las vistas previas están en **All non-Production branches**.

## Comprobaciones después de publicar

- El sitio carga con HTTPS en escritorio y en el celular.
- Una dirección inexistente responde con la página 404 propia y código 404.
- Las comprobaciones de buscadores y vista previa al compartir de [`seo.md`](seo.md).
- Después de una sincronización con cambios en `main`, **Deployments** muestra una publicación nueva y la fecha de actualización del pie cambia.

## Si algo falla

- **La compilación falla.** En **Deployments**, abrir la publicación fallida y leer el registro. Si menciona una versión de Node.js distinta de 24.21.0, revisar la variable `NODE_VERSION`.
- **El dominio queda en «Pending».** Revisar en **DNS** → **Records** que exista el `CNAME` `congreso` con la nube naranja (proxy activado).
- **Volver a una versión anterior.** En **Deployments**, abrir el menú (⋯) de una publicación anterior y elegir **Rollback to this deployment**. La siguiente publicación desde `main` la reemplaza.
