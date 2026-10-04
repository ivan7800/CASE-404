# Changelog

## 1.2.0 — Simple Links

### Changed
- Eliminado el botón **Conectar** del Evidence Board.
- Cada tarjeta incluye cuatro puntos visibles para crear relaciones por arrastrar y soltar.
- El hilo provisional sigue el cursor y resalta la tarjeta de destino.
- Las nuevas relaciones guardan el lado de origen/destino sin romper relaciones antiguas.
- Texto de ayuda simplificado: mover, unir y borrar.
- Caché PWA actualizada a `case404-v1.2.0`.

### Compatibility
- Sin cambio de esquema de casos.
- Casos y conexiones de v1.0/v1.1 siguen siendo válidos.


## 1.1.1 — Button initialization hotfix

### Fixed
- Corregido el fallo crítico que dejaba sin listeners a `Nuevo caso`, `Importar`, navegación y acciones globales: `bind()` existía pero no se invocaba durante `boot()`.
- Actualizada la caché del Service Worker a `case404-v1.1.1` para expulsar assets de la v1.1.0 defectuosa.

## v1.1.0 — UX PREMIUM · Evidence Board Motion

### Added
- Preview dinámico de la conexión desde el nodo origen hasta el cursor.
- Animación corta de trazado al crear una conexión.
- Pulso contextual en el nodo origen y feedback de nodos destino.
- Microanimaciones de alta/baja de tarjetas y conexiones.
- Estado visual de arrastre y zoom/encaje suavizado desde la toolbar.
- Pulido de hover en tarjetas secundarias sin añadir animación global permanente.

### Changed
- El lenguaje de movimiento del Evidence Board prioriza estado y causalidad sobre decoración.
- Respeta `prefers-reduced-motion` y el ajuste de movimiento de CASE 404.
- Cache PWA actualizada a `case404-v1.1.0`.

# CHANGELOG

## v1.0.3 — STABLE · Startup / New Case / Import Fix

### Fixed
- Corregida la causa que dejaba `Nuevo caso` e `Importar` sin respuesta al abrir la app por `file://`: los ES Modules ya no son necesarios en runtime.
- Añadido `js/app.bundle.js` clásico para arranque compatible.
- Añadido fallback de almacenamiento si IndexedDB no está disponible.
- Los listeners de `Nuevo caso` e `Importar` se registran antes de inicializar módulos avanzados, evitando fallos en cascada.
- Service Worker y precache actualizados a `case404-v1.0.3` y al bundle real.

### Verification
- `node --check` del bundle y de todos los fuentes JS: PASS.
- Imports ES runtime en `index.html`: 0.
- Referencia a `app.bundle.js`: presente.
- Imports internos no resueltos en bundle: 0.

# Changelog

## v1.0.2 — STABLE · Button & Legacy Data Bugfix
- Corregido el hit-testing del Evidence Board: la capa transparente de nodos ya no intercepta los clics destinados a las conexiones.
- Los nodos individuales conservan interacción completa mediante `pointer-events: auto`, mientras el contenedor de nodos queda transparente al puntero.
- Las conexiones pueden seleccionarse de nuevo y la acción **Eliminar** borra la conexión seleccionada.
- Normalización reforzada de fichas importadas/heredadas: `tags`, listas y vínculos de teorías dejan de poder romper el render del expediente por formatos antiguos o malformados.
- Las filas importadas sin identificador válido se descartan de forma segura en lugar de provocar excepciones posteriores.
- Batería de interacción ampliada: **82/82 PASS**, sin `pageerror` ni errores de consola.
- Prueba dirigida de conexión: crear → seleccionar con ratón → eliminar: **PASS**.
- Prueba de importación heredada/malformada → abrir expediente: **PASS**, 0 errores de página.
- Cache PWA actualizada a `case404-v1.0.2`.
- El esquema de exportación permanece en `version: 10`; no requiere migración.

## v1.0.1 — STABLE · GitHub Final
- Release de hardening sin nuevas funciones de producto.
- Validación de imágenes importadas del Evidence Board antes de construir `img src`.
- Lista blanca para el estado de certeza usado en clases dinámicas de Timeline.
- Descarga de adjuntos limitada a formatos `data:` base64 aceptados.
- Importación más robusta ante casos y filas de módulos malformados; límite de 250 casos por paquete.
- Normalización de Writer Mode tolerante a registros importados inválidos.
- Cache PWA actualizada a `case404-v1.0.1`.
- Añadidos `LICENSE` MIT, `.gitignore`, `SECURITY.md` y `RELEASE_NOTES.md`.
- El esquema de exportación permanece en `version: 10`; no requiere migración.

## v1.0.0 — STABLE · Final QA
- Release final del ciclo inicial de CASE 404.
- Exportación `.case404` y backup actualizados a `version: 10`.
- Cache PWA actualizada a `case404-v1.0.0`.
- Service Worker endurecido: fallback a `index.html` solo para navegación, caché dinámica limitada a mismo origen y respuestas correctas, sin interceptar POST ni recursos cross-origin.
- Importación segura: un UUID ya existente crea una copia en lugar de sobrescribir silenciosamente datos locales.
- Los paquetes con `version > 10` se rechazan con aviso de incompatibilidad.
- Límite de 64 MB para archivos de importación.
- Corregido un bug transversal de diálogos: `Cancelar` y `×` eran submits implícitos y podían activar el guardado. Ahora son acciones de cierre explícitas y no alteran datos.
- Auditoría funcional automatizada final: 37/37 comprobaciones, 0 errores JavaScript.
- Auditoría de controles estáticos: 78 botones, 0 controles sin ruta de acción.
- Adaptador IndexedDB validado para put/get/list/delete/clear/replaceAll mediante simulador.
- Service Worker validado para install/activate, limpieza de caché antigua, política same-origin y fallback de navegación mediante simulador.
- Todos los módulos JavaScript y `sw.js` superan comprobación de sintaxis.
- Manifest, imports, precache y rutas relativas revisados para despliegue en subcarpeta de GitHub Pages.
- Responsive final validado a 390 × 844 sin overflow horizontal global.

## v0.9.0 — Phase 9 · Premium UI
- Nueva capa `premium.css` que moderniza la interfaz sin cambiar el modelo de datos.
- Seis skins seleccionables y persistentes: NOIR 404, COLD CASE, POLICE ARCHIVE, CYBER INVESTIGATION, CLASSIFIED y MINIMAL DARK.
- Preferencias de densidad cómoda/compacta.
- Movimiento completo, reducido o dependiente de `prefers-reduced-motion`.
- Evidence Board con superficie oscuro técnico, corcho/expediente o rejilla forense.
- Microinteracciones, elevación, feedback activo, estados de navegación y foco de teclado revisados.
- Ajustes visuales responsive y cero overflow global en viewport 390 × 844 durante QA aislado.
- Contraste base de texto principal >15:1 y secundario >6.9:1 en las seis skins.
- Exportaciones `.case404` y backups actualizadas a `version: 9`.
- Cache PWA actualizado a `case404-v0.9.0`, incluyendo `premium.css` y `theme.js`.
- Compatibilidad con expedientes de fases anteriores mantenida; las preferencias visuales viven fuera del caso en `localStorage`.

## v0.8.0 — Phase 8 · Reports
- Nuevo módulo **Case Report Studio**.
- Plantillas Ejecutivo, Expediente completo y Narrativo.
- Selector de 10 secciones del expediente con previsualización inmediata.
- Portada de caso, KPIs, cronología, fichas de personas/lugares/evidencias/documentos, hipótesis, relaciones, Writer Mode y alertas de continuidad.
- Salida de impresión optimizada para usar **Guardar como PDF** del navegador sin librerías externas.
- Exportación de informe HTML autónomo con CSS embebido.
- Exportación Markdown respetando las secciones seleccionadas.
- Los informes se regeneran desde los datos vivos del caso y no crean una segunda fuente de verdad.
- Escape HTML de los campos de usuario en la salida generada.
- Reports se actualiza tras cambios en Evidence Board, Investigation DB, Theory Engine y Writer Mode.
- Exportaciones `.case404` y backups actualizadas a `version: 8`.
- Cache PWA actualizado a `case404-v0.8.0` e inclusión de `reports.js`.
- Compatibilidad con expedientes de fases anteriores mantenida.

## v0.7.0 — Phase 7 · Writer Mode
- Nuevo módulo **Writer Mode / Narrative Continuity Studio**.
- Registros correlativos y persistentes para capítulos `CH-xxx`, escenas `SC-xxx`, pistas `CL-xxx` y secretos `S-xxx`; los contadores no reutilizan referencias borradas.
- Capítulos con orden narrativo, POV, rótulo temporal, resumen y etiquetas.
- Escenas vinculadas a capítulo y personajes de Investigation DB, con POV, lugar, resumen y registro de secretos utilizados.
- Pistas con introducción, foreshadowing, callbacks, revelación, resolución y estados abierta/resuelta/red herring.
- Secretos con primera insinuación, revelación a la audiencia, resolución y descubrimientos por personaje/capítulo.
- Nuevo **Continuity Engine** con detección de orden de capítulos duplicado, escenas sin capítulo, referencias huérfanas, revelaciones/resoluciones prematuras y pistas abiertas sin resolución.
- Detección explícita de **conocimiento prematuro**: un personaje usa un secreto en una escena antes del capítulo donde consta que lo descubre.
- Poda de referencias narrativas al eliminar personas, capítulos o secretos, evitando dependencias fantasma.
- Exportaciones `.case404` y backups actualizadas a `version: 7`.
- Cache PWA actualizado a `case404-v0.7.0` e inclusión de `writer.js`.
- Compatibilidad de migración mantenida con expedientes de fases anteriores: `modules.writer` se normaliza a una estructura vacía cuando no existe.

## v0.6.0 — Phase 6 · Connection Graph
- Nuevo módulo **Connection Graph / Relationship Network**.
- Grafo derivado automáticamente de personas, lugares, evidencias, eventos, documentos y teorías; no crea una base paralela de relaciones.
- Importa conexiones manuales entre fichas enlazadas del Evidence Board.
- Representa vínculos `A favor` y `En contra` del Theory Engine como relaciones diferenciadas.
- Reconoce Evento → Persona mediante nombre/alias y Evento → Lugar mediante nombre/ubicación estructurada.
- Detecta referencias explícitas `P-xxx`, `L-xxx`, `E-xxx`, `EV-xxx`, `D-xxx` y `T-xxx` escritas en campos del expediente.
- Inferencia opcional por etiquetas compartidas; desactivada por defecto y visualmente diferenciada.
- Filtros por tipo de nodo, tipo de relación y texto.
- Métricas de nodos visibles, relaciones, componentes conectados y pares con conexión indirecta de dos saltos.
- Buscador de ruta más corta entre dos nodos usando solo los filtros activos.
- Acción `Sugerir indirecta` para localizar automáticamente una cadena de 2–4 saltos que no tenga conexión directa.
- Resaltado visual de la ruta encontrada y desglose de cada relación de la cadena.
- Doble clic sobre nodos del grafo abre la ficha de Investigation DB o la teoría T-xxx original.
- Zoom, pan y encaje del grafo sin dependencias externas.
- Corregido durante QA un fallo por rerender prematuro que podía impedir el doble clic sobre nodos SVG.
- Exportaciones `.case404` y backups actualizadas a `version: 6`.
- Cache PWA actualizado a `case404-v0.6.0` e inclusión de `graph.js`.
- Compatibilidad de migración mantenida con expedientes de fases anteriores.

## v0.5.0 — Phase 5 · Theory Engine
- Nuevo módulo **Theory Engine / Hypothesis Lab** para crear y comparar hipótesis.
- Referencias correlativas de teoría `T-001`, `T-002`… con contador persistente que evita reutilización tras borrar.
- Estados de hipótesis: activa, alternativa, debilitada y descartada.
- Clasificación de cualquier registro de Investigation DB como **A favor** o **En contra**.
- Peso configurable 1–3 por vínculo; un registro no puede permanecer simultáneamente en ambos lados.
- Índice de soporte interno transparente: `peso a favor / peso total clasificado`.
- Indicador de base baja/media/alta según el peso total clasificado para contextualizar porcentajes extremos.
- Preguntas abiertas y contradicciones/debilidades manuales por teoría.
- Matriz comparativa ordenada por soporte relativo con pesos, preguntas y tamaño de base.
- Búsqueda por hipótesis, etiquetas, preguntas y registros vinculados; filtro por estado.
- Los títulos de vínculos se resincronizan al editar registros de Investigation DB.
- Al eliminar un registro, se podan sus referencias de todas las teorías para evitar vínculos huérfanos.
- Exportaciones `.case404` y backups actualizadas a `version: 5`.
- Cache PWA actualizado a `case404-v0.5.0` e inclusión de `theory.js`.
- Compatibilidad de migración mantenida con expedientes de fases anteriores.

## v0.4.0 — Phase 4 · Timeline 404
- Nueva cronología visual proporcional para los registros de tipo Evento.
- Intervalos Inicio/Fin con duración visible y distribución por carriles cuando coinciden en el tiempo.
- Zoom temporal entre 50 % y 250 %, encaje rápido y desplazamiento horizontal interno.
- Filtro de búsqueda por evento, sujeto, lugar, fuente, descripción o etiqueta.
- Filtro por certeza: confirmado, probable, declarado o desconocido.
- Detección de huecos temporales con umbral configurable de 30 min a 24 h.
- Detección de intervalos inválidos cuyo final sea anterior al inicio.
- Aviso de posible conflicto espacio-temporal cuando un mismo sujeto aparece en lugares distintos durante intervalos solapados.
- Campo `Personas / sujetos` añadido a la ficha Evento.
- Las tarjetas y alertas de Timeline abren la ficha EV-xxx original en Investigation DB.
- Timeline se resincroniza al crear, editar o eliminar eventos.
- Corregida durante QA una referencia DOM incorrecta del indicador de zoom (`timelineZoomLabel` → `timelineZoomReset`).
- Exportaciones `.case404` y backups actualizadas a `version: 4`.
- Cache PWA actualizado a `case404-v0.4.0` e inclusión de `timeline.js`.
- Compatibilidad mantenida con expedientes de fases anteriores.

## v0.3.0 — Phase 3 · Investigation DB
- Base estructurada de personas, lugares, evidencias, eventos y documentos.
- Referencias correlativas por tipo de registro.
- Formularios específicos por entidad, búsqueda y etiquetas.
- Adjuntos portables para documentos (máx. 4 MB).
- Botón «Al tablero» para crear tarjetas enlazadas.
- Sincronización de cambios de ficha hacia su tarjeta de Evidence Board.
- Al eliminar una ficha se retira su nodo enlazado y sus conexiones.
- Doble clic en tarjeta enlazada abre la ficha estructurada.
- Migración compatible con expedientes v0.1/v0.2.
