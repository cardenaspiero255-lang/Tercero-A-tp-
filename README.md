# Portal 3.º Medio A TP

Portal del curso con horario de lunes a viernes, tareas, evaluaciones, avisos y enlaces. Interfaz adaptable a móviles, modo oscuro y medidor de FPS. Proyecto estático sin dependencias de pago ni créditos de IA.

## Ejecutar y probar

```bash
npm run check
python3 -m http.server 8080
```

La web se despliega automáticamente en Vercel al conectar el repositorio. Se utiliza la configuración `vercel.json`.

## Limitaciones importantes

Los datos de tareas, evaluaciones, avisos, enlaces y notas **se guardan solamente en el navegador** (localStorage). No hay sincronización entre alumnos ni autenticación de administradores. No se debe usar como plataforma oficial de comunicación hasta desarrollar y verificar un backend con controles de acceso adecuados. Los FPS indicados son aproximados; 120 FPS reales requieren medición en hardware compatible.