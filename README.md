# CASE 404 — Investigation Studio

**v1.2.0 SIMPLE LINKS**

Aplicación web **local-first, offline y sin backend** para construir investigaciones visuales, analizar cronologías y relaciones, trabajar con hipótesis y planificar narrativas de misterio. Está hecha con HTML, CSS y JavaScript puro, sin frameworks ni CDN.

## Qué incluye

- **Case Files**: creación, edición, búsqueda, estados, etiquetas, importación y exportación.
- **Evidence Board**: nodos, fotografías, drag & drop, conexiones, zoom, pan y fichas enlazadas.
- **Investigation DB**: personas, lugares, evidencias, eventos y documentos con referencias `P-`, `L-`, `E-`, `EV-` y `D-`.
- **Timeline 404**: intervalos, filtros, huecos, concurrencias y posibles conflictos espacio-temporales.
- **Theory Engine**: hipótesis `T-xxx`, evidencias a favor/en contra, pesos 1–3, preguntas, contradicciones e índice de soporte interno.
- **Connection Graph**: grafo derivado de relaciones explícitas, teorías, eventos y referencias cruzadas; rutas indirectas y filtros.
- **Writer Mode**: capítulos `CH-xxx`, escenas `SC-xxx`, pistas `CL-xxx`, secretos `S-xxx` y Continuity Engine.
- **Reports**: informes ejecutivo/completo/narrativo, impresión/Guardar como PDF, HTML autónomo y Markdown.
- **Premium UI**: NOIR 404, COLD CASE, POLICE ARCHIVE, CYBER INVESTIGATION, CLASSIFIED y MINIMAL DARK.
- **PWA**: shell offline, manifest y rutas relativas compatibles con GitHub Pages en subcarpeta.

## Privacidad y almacenamiento

Los expedientes se guardan en **IndexedDB dentro del navegador**. CASE 404 no incorpora telemetría, cuentas, backend ni llamadas a APIs externas.

Las preferencias visuales se guardan en `localStorage` y no modifican el contenido del expediente.

Haz copias de seguridad periódicas desde **Ajustes → Exportar todos los casos**. Los archivos `.case404` y los backups de v1.0 usan `version: 10`.

### Importación segura

- Los paquetes de versiones anteriores se normalizan al abrirlos.
- Si se importa un caso cuyo UUID ya existe localmente, CASE 404 **no sobrescribe el original**: crea una copia con UUID nuevo y sufijo `(importado)`.
- Un paquete con una versión de formato posterior a la soportada se rechaza en lugar de interpretarse de forma insegura.
- Tamaño máximo de archivo importado: **64 MB**.

## Límites de adjuntos

- Documento portable: máximo **4 MB** por archivo.
- Fotografía de Evidence Board: máximo **12 MB** de entrada; se redimensiona/comprime para el expediente.

Los adjuntos forman parte del caso exportado, por lo que expedientes con mucho material pueden crecer rápidamente.

## Ejecutar en local

Para disponer de IndexedDB y Service Worker en un origen normal, sirve la carpeta por HTTP:

```bash
python -m http.server 8080
```

Después abre `http://localhost:8080/`.

No es necesario instalar dependencias ni ejecutar un build.

> **v1.0.3:** la interfaz principal ya no depende de ES Modules para arrancar, por lo que `index.html` puede abrirse también con doble clic para uso básico. Si IndexedDB no está disponible se activa automáticamente un almacenamiento local de compatibilidad. Para PWA, Service Worker y la prueba equivalente a producción sigue siendo recomendable HTTP/HTTPS (servidor local o GitHub Pages).

## Publicar en GitHub Pages

1. Crea un repositorio, por ejemplo `CASE-404`.
2. Sube **el contenido de esta carpeta a la raíz del repositorio**; `index.html` debe quedar en la raíz.
3. En GitHub: **Settings → Pages**.
4. Elige **Deploy from a branch**.
5. Selecciona `main` y `/ (root)`.
6. Abre la URL publicada y haz una recarga completa una vez tras actualizar una versión para permitir que el nuevo Service Worker tome el control.

Todas las rutas de aplicación son relativas (`./`), por lo que funcionan bajo una URL del tipo:

```text
https://usuario.github.io/CASE-404/
```

El archivo `.nojekyll` evita procesamiento innecesario de Jekyll.

## Interpretación de análisis

### Timeline

Un solapamiento temporal es una **alerta mecánica**, no una demostración de contradicción. CASE solo marca una posible incompatibilidad cuando los datos introducidos lo justifican estructuralmente.

### Theory Engine

El porcentaje mostrado es:

```text
peso a favor / peso total clasificado
```

No es una probabilidad estadística, una medida de culpabilidad ni una conclusión automática.

### Connection Graph

Las conexiones fuertes se derivan de datos explícitos. Las coincidencias por etiqueta son inferencias débiles y permanecen desactivadas por defecto.


## Conexiones simples del Evidence Board

La v1.2 elimina el paso de activar un modo **Conectar**. Cada tarjeta muestra cuatro puntos rojos de conexión.

1. Crea o fija dos tarjetas en el tablero.
2. Arrastra uno de los puntos rojos de la primera tarjeta.
3. Suelta el hilo encima de la segunda tarjeta.
4. Para borrar una relación, haz clic en el hilo y pulsa **Eliminar** o la tecla `Supr`.

Las conexiones existentes siguen siendo compatibles. Las nuevas conexiones recuerdan el lado de la tarjeta desde el que se creó el hilo.

## QA de v1.2.0

Consulta [`QA_FINAL.md`](./QA_FINAL.md). v1.0.3 conserva las correcciones funcionales de v1.0.2 y cambia el arranque a un bundle clásico `js/app.bundle.js`, evitando que `file://` bloquee los imports de la aplicación. También incorpora fallback de almacenamiento si IndexedDB no está disponible. El código fuente modular se conserva para mantenimiento.

La política administrada del Chromium disponible en el entorno de construcción bloqueó la navegación real a `localhost`, por lo que el ciclo IndexedDB + Service Worker no pudo certificarse en una sesión completa bajo un origen HTTP real. Ambos componentes se probaron por separado con simuladores y todos los assets se verificaron bajo una subruta HTTP equivalente a GitHub Pages.

## Seguridad

CASE 404 considera los archivos importados como entrada no confiable. El render dinámico escapa texto de usuario, las imágenes del tablero importadas deben ser `data:image/...;base64`, los adjuntos descargables se limitan a formatos `data:` base64 aceptados y los valores que forman clases dinámicas se normalizan o validan.

Consulta [`SECURITY.md`](./SECURITY.md) para el modelo de seguridad y las recomendaciones al compartir expedientes.

## Estructura del repositorio

```text
CASE-404/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
├── js/
├── assets/
├── README.md
├── CHANGELOG.md
├── RELEASE_NOTES.md
├── QA_FINAL.md
├── SECURITY.md
├── LICENSE
└── .nojekyll
```

## Licencia

Distribuido bajo licencia **MIT**. Consulta [`LICENSE`](./LICENSE).


## Microinteracciones v1.1

El Evidence Board incorpora un lenguaje de movimiento funcional: preview del vínculo al conectar, trazado breve de nuevas conexiones, pulso del nodo origen, feedback de destinos, estados de arrastre y eliminación y zoom suavizado desde la barra. Las animaciones son contextuales y se reducen automáticamente con `prefers-reduced-motion` o el ajuste de movimiento de la aplicación.
