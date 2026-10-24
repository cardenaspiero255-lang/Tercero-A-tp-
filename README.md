# Portal 3.º Medio A TP — Liceo Requínoa

**Portal escolar sin inteligencia artificial**: https://tercero-a-tp.vercel.app

La web está alojada en Vercel y usa una base Supabase independiente de otros proyectos. Código fuente público; los datos privados residen en Supabase con controles por fila (RLS).

## Funciones del portal

### Sin iniciar sesión
- Horario de lunes a viernes, materias, horas y vista imprimible.
- Tareas, evaluaciones, recordatorios y apuntes **locales**, con cuenta regresiva y progreso.
- Biblioteca local de enlaces, modo claro/oscuro y exportación/importación de datos JSON.
- Lectura de publicaciones generales y calendario mensual de evaluaciones/actividades del curso.
- Interfaz adaptable a teléfono y ordenador, PWA con caché pública.

### Para miembros autenticados y verificados
- Correo con enlace de acceso y código privado de invitación para participar.
- Publicación compartida de evaluaciones, avisos y actividades; el administrador modera o retira.
- Encuestas (2 a 5 alternativas), una respuesta por cuenta, resultados agregados.
- Biblioteca compartida de PDF, Word, TXT e imágenes: máximo 5 MB, bucket **privado** y descarga temporal.
- Mensajes directos privados remitente/destinatario, alias opcional, hasta 500 caracteres por mensaje y mecanismo de reporte. **No es un sistema cifrado de extremo a extremo**.
- Copia personal en la nube con **subida y recuperación manual**, siempre confirmadas; se crea respaldo local antes de restaurar. No es sincronización automática en vivo.
- Avisos diarios programados de evaluaciones y avisos inmediatos **de mejor esfuerzo** al publicar un nuevo evento, solo a suscriptores que aceptaron las notificaciones.

### Solo administrador
- Corregir, cerrar o retirar contenido compartido.
- Estadísticas agregadas: publicaciones, encuestas, votos, mensajes (solo recuento), archivos, visitas diarias de **miembros autenticados** y reportes pendientes.
- Los mensajes privados y las identidades de votantes **no están disponibles para lectura administrativa**.

## Diseño de seguridad

- Nuevas tablas con RLS y permisos específicos: `supabase/portal-v2.sql`.
- Privacidad y controles de roles comprobados con fixtures transaccionales en `supabase/portal-v2-rls-tests.sql`, que deben ejecutarse con `BEGIN` / `ROLLBACK` exclusivamente.
- Materiales en bucket privado `portal-study-files`, MIME permitido y tamaño limitado; sin análisis antivirus automatizado: no subir datos personales ni archivos que no sean de confianza.
- Los nombres de usuarios visibles para mensajes son seudónimos; nunca se publica la lista de correos.
- La copia personal se vincula al usuario autenticado y no incluye credenciales, contraseñas ni mensajes privados.
- El envío inmediato de Web Push verifica el JWT del autor del contenido e idempotencia por evento/suscripción. No garantiza entrega a un dispositivo desconectado; queda pendiente certificación E2E con otro alumno.
- Límite de publicaciones, encuestas y mensajes para reducir abuso.

## Despliegue y mantenimiento

```sh
npm ci
npm run check
```

Las variables Supabase, VAPID y CRON_SECRET se configuran **solo en Vercel** y nunca se suben a GitHub. La API pública proporciona únicamente URL y clave publicable, nunca secretos.

**Limitaciones conocidas:** no hay asistente de IA; no hay análisis antivirus; el chat requiere conexión; las tareas y notas locales solo se llevan a otro dispositivo mediante la sincronización explícita; las métricas de visitas no incluyen anónimos; los avisos inmediatos requieren al menos un miembro suscrito y un evento nuevo. Las funciones compartidas requieren que sus alumnos estén registrados y autorizados.

## Pruebas y certificación pendiente

La CI valida sintaxis, funciones puras, permisos por código y controladores. La migración se comprobó mediante transacciones reales reversibles en Supabase. Siguen faltando una prueba real de dos dispositivos, entrega efectiva de push a un tercero y validación de subida/descarga desde un teléfono. No debe afirmarse que estas pruebas físicas se hicieron hasta contar con evidencias.
