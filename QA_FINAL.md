# QA FINAL — CASE 404 v1.2.0 SIMPLE LINKS

## Objetivo

Validar la simplificación del Evidence Board sin modificar el modelo principal de casos.

## Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| Sintaxis `js/board.js` | PASS | `node --check` |
| Sintaxis `js/app.bundle.js` | PASS | `node --check` |
| Manifest JSON | PASS | parse correcto |
| Botón antiguo `#connectTool` eliminado | PASS | no aparece en `index.html` |
| Ayuda directa visible | PASS | texto «Arrastra un punto rojo…» |
| 4 puntos por tarjeta | PASS | `nodeHtml()` genera 4 `.node-connector` |
| Elección automática de lados horizontal | PASS | right → left |
| Elección automática de lados vertical | PASS | bottom → top |
| Crear relación directa | PASS | `createEdge()` añade edge |
| Conservar lado de origen/destino | PASS | `fromSide` / `toSide` |
| Evitar relación duplicada | PASS | segunda relación inversa rechazada |
| Bundle contiene la UX directa | PASS | `node-connector` + `finishDirectConnect` |
| Caché PWA versionada | PASS | `case404-v1.2.0` |

## Prueba de navegador

Se intentó ejecutar Chromium con Playwright tanto sobre `file://` como mediante una ruta HTTPS interceptada. El navegador administrado del entorno respondió `ERR_BLOCKED_BY_ADMINISTRATOR` antes de cargar la página. Por tanto, **no se marca como ejecutado** el gesto visual completo de drag & drop en Chromium.

## Compatibilidad

- Sin cambio del esquema principal de datos.
- Las conexiones antiguas no necesitan `fromSide`/`toSide`: usan anclaje automático.
- Las conexiones nuevas pueden guardar esos campos opcionales.
- Rutas de producción siguen siendo relativas para GitHub Pages.

## Estado

**RC funcional para probar en navegador real/GitHub Pages.** La lógica y el empaquetado pasan las comprobaciones disponibles; queda pendiente únicamente la confirmación manual del gesto pointer en el navegador final debido a la política del Chromium del entorno.
