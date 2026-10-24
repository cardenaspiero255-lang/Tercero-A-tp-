# Portal 3.º Medio A TP — colaboración aislada

Portal escolar que conserva horario, apuntes y tareas personales. La rama `feature/curso-colaborativo-v1` implementa publicaciones compartidas, roles y recordatorios Web Push **solo en pruebas**. No se debe fusionar con `main` sin comprobar inicio de sesión, base de datos y entrega real.

## Sistema exclusivo del colegio

- Supabase `Portal 3 Medio A TP` (`xvoaddorhezxddyaomsu`, São Paulo). **No usar GameHub Ultra ni claves de otros proyectos.**
- Cinco tablas escolares con RLS. Publicaciones legibles sin cuenta; se requiere inicio de sesión verificado y código de invitación para publicarlas.
- El administrador se reconoce por el correo verificado registrado en `portal_private.config`, tabla no expuesta al navegador. Los compañeros pueden crear publicaciones; solo el administrador puede modificarlas o retirarlas.
- `supabase/portal.sql` se aplicó primero; `supabase/secure-bootstrap.sql` es **una plantilla** de instalación del acceso seguro, no contiene secretos y no debe ejecutarse con marcadores sin sustituir. La configuración real con hashes de códigos ya está aplicada al proyecto escolar.
- El acceso de administrador y alumnos usa RPC con usuario autenticado y funciones de servidor PostgreSQL restringidas; no necesita `SUPABASE_SECRET_KEY` ni una clave `service_role` en Vercel.

## Variables de Vercel

Estas variables de entorno se aplican **solo al proyecto escolar**, y de momento **solo en Preview**:

| Clave | Alcance | Estado |
| --- | --- | --- |
| `SUPABASE_URL` | Publicable / Preview | Configurada |
| `SUPABASE_PUBLISHABLE_KEY` | Publicable / Preview | Configurada |
| `CRON_SECRET` | Privada / Preview | Configurada |
| `VAPID_PUBLIC_KEY` | Pública / Preview | Configurada |
| `VAPID_PRIVATE_KEY` | Privada / Preview | Configurada |
| `PORTAL_ADMIN_EMAIL` | Cifrada / Preview | Configurada como dato de referencia; autorización real en PostgreSQL |
| `PORTAL_FEATURE_ACTIVE` | Preview | **Desactivada por defecto**, habilitar solo para pruebas del portal |

El código de invitación se almacena únicamente mediante un hash SHA-256 dentro de la tabla privada; **no se publica ni se añade al repositorio**. El administrador debe entregarlo por un canal privado a cada compañero.

## Acceso por correo (todavía pendiente)

Supabase limita su SMTP predeterminado a direcciones pertenecientes a su organización y **2 mensajes/hora**. No sirve para abrir el registro a todo el curso. Un administrador del servicio debe configurar un SMTP propio o un proveedor de autenticación compatible y comprobar la dirección de retorno de Auth (`https://tercero-a-tp.vercel.app/`) en el panel de Supabase, **Authentication → URL Configuration**. No pedir contraseñas, tokens ni claves SMTP en el chat; se ingresan exclusivamente en el panel del proveedor.

Después, probar como administrador y como alumno en dos navegadores separados, incluyendo la recuperación de sesión, publicación, modificación y borrado por roles.

## Recordatorios diarios

La ruta `/api/reminders` comprueba el bearer privado `CRON_SECRET`. Selecciona las próximas evaluaciones y reserva en la DB cada suscripción/día mediante `portal_claim_daily_push_jobs` con el mismo secreto. Envía como máximo un resumen diario por suscriptor, manejando las suscripciones caducadas. El plan Vercel Hobby ejecuta la tarea diaria con margen horario; **no garantiza recepción ni minuto exacto**. Se requiere permiso explícito del dispositivo. No se ha probado todavía una entrega real.

## Seguridad

Los asesores de Supabase pueden señalar cuatro funciones `SECURITY DEFINER` invocables mediante RPC; **está previsto** por el diseño y solo hacen operaciones limitadas después de autenticar al usuario y verificar correo/código/hash secreto. Antes de habilitar producción, hacer pruebas de integración adversariales y considerar mover estas funciones a una capa backend más aislada si se detecta riesgo.

## Pruebas

```sh
npm run check
```

El panel de tareas local sigue funcionando si la colaboración está deshabilitada.
