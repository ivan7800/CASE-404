# CASE 404 v1.2.0 — SIMPLE LINKS

Esta versión simplifica la función principal del Evidence Board.

## Qué cambia

- Ya no hace falta pulsar **Conectar**.
- Cada tarjeta muestra cuatro puntos rojos de conexión.
- Arrastra un punto hasta otra tarjeta para crear el hilo.
- El destino se resalta mientras arrastras.
- El hilo aparece en vivo y conserva el lateral desde el que fue creado.
- Para borrar: selecciona el hilo y pulsa **Eliminar** o `Supr`.
- Mover tarjetas, zoom, encajar, notas, personas, lugares, evidencias y fotos mantienen su funcionamiento anterior.

## Compatibilidad

No cambia el esquema de datos. Los expedientes existentes siguen siendo compatibles. Las conexiones antiguas se renderizan con anclaje automático y las nuevas pueden guardar `fromSide`/`toSide`.

## PWA

Service Worker actualizado a `case404-v1.2.0` para evitar servir la interfaz anterior desde caché.

## Verificación

Se comprobó sintaxis de fuentes y bundle, presencia de los cuatro conectores por tarjeta, creación lógica de relaciones, prevención de duplicados, persistencia de anclajes y eliminación del antiguo botón Conectar. El Chromium administrado del entorno bloqueó la navegación de prueba (`ERR_BLOCKED_BY_ADMINISTRATOR`), por lo que el gesto visual completo debe confirmarse también en el navegador final/GitHub Pages.
