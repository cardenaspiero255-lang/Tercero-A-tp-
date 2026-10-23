# Portal 3.º Medio A TP — comunidad del curso

Portal web del curso **3.º Medio A TP · Liceo Requínoa**. Horario de lunes a viernes, tareas y apuntes personales, avisos/evaluaciones compartidos, calendario de exámenes y notificaciones Web Push optativas.

## Permisos

- Cualquier visitante puede consultar el calendario y las publicaciones compartidas.
- Los alumnos entran con un enlace de correo (Supabase Auth) y se unen mediante un **código privado del curso**. Una vez registrados pueden publicar evaluaciones o avisos directamente, sin aprobaciones. Se aplican límites de cinco publicaciones por persona y 24 horas.
- Solo el administrador puede **editar o retirar cualquier publicación**. La cuenta admin se autoriza en el servidor comprobando un correo VERIFICADO contra la variable privada `PORTAL_ADMIN_EMAIL`; nunca por una preferencia editable del cliente.
- Los datos personales de tareas, materiales, notas y progreso permanecen en el navegador (`localStorage`) y no son visibles para otras personas.
- Cada alumno activa/desactiva voluntariamente notificaciones en su dispositivo. Para activarlas debe estar inscrito y permitirlas en el navegador.

## Preparación: base de datos escolar separada

**NO ejecutar la migración en la base de datos de GameHub Ultra.** Crear un proyecto independiente de Supabase para el colegio. Antes de crearlo, confirmar el importe del plan con el propietario. Aplicar `supabase/portal.sql` en el SQL Editor del proyecto escolar. Se crean tablas `portal_roles`, `portal_members`, `portal_posts`, `portal_push_subscriptions` y `portal_delivery_log`, con políticas RLS.

En **Supabase → Authentication → URL Configuration**, configurar la URL principal `https://tercero-a-tp.vercel.app` y añadir `https://tercero-a-tp.vercel.app/**` como redirección autorizada. El servicio de correo predeterminado de Supabase puede tener cuotas muy bajas: comprobar los límites de envío antes de invitar al curso. Nunca revelar claves secretas en el repositorio.

## Variables de entorno en Vercel

Configurar desde Vercel → Proyecto → Settings → Environment Variables (producción):

| Variable | Visibilidad | Uso |
| --- | --- | --- |
| `SUPABASE_URL` | Servidor y configuración pública | URL del proyecto escolar, `https://ref.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Pública | Clave `sb_publishable_...` de Supabase |
| `SUPABASE_SECRET_KEY` | **Secreta, solo servidor** | Clave `sb_secret_...` de Supabase, acceso elevado |
| `PORTAL_ADMIN_EMAIL` | **Privada** | Correo verificado de la única persona administradora |
| `CLASSROOM_INVITE_CODE` | **Secreta** | Código largo, aleatorio y único para autorizar colaboradores. No subirlo a GitHub |
| `VAPID_PUBLIC_KEY` | Pública | Clave pública VAPID (P-256) |
| `VAPID_PRIVATE_KEY` | **Secreta** | Clave privada VAPID correspondiente |
| `CRON_SECRET` | **Secreta** | Cadena aleatoria de 32+ caracteres para proteger el cron |

Se pueden generar claves VAPID con la utilidad pública `npx web-push generate-vapid-keys` después de instalar el paquete. Ejecutar esto en equipo de confianza y copiar las claves mediante el panel, nunca en un chat, CI ni código.

Tras añadir las variables, redeplegar. El endpoint público `GET /api/public-config` mostrará `enabled:true` cuando la URL y clave publicable sean válidas, pero **no expone secretos**. Verificar el flujo real con una cuenta admin verificada, otro alumno con código y un tercer usuario que intente editar sin autorización. El sitio seguirá presentando el estado «pendiente de base de datos» mientras no se configure.

## Recordatorios diarios

`vercel.json` define un cron `0 12 * * *`, **12:00 UTC todos los días**, orientado a las 09:00 de Chile durante el horario de verano. Vercel Hobby puede ejecutarlo en cualquier momento de esa hora, no garantiza la hora exacta. Su única ruta es `/api/reminders`, protegida por `CRON_SECRET`. El servidor selecciona las tres evaluaciones más próximas dentro de 30 días, calcula los días restantes según `America/Santiago` y envía **un resumen al día por dispositivo suscrito**. Las entregas se registran para reducir duplicados. Los navegadores pueden bloquear las notificaciones; en iPhone puede ser necesario añadir la PWA a la pantalla de inicio.

La notificación solo se envía cuando hay evaluaciones próximas. El recordatorio no significa que una prueba esté confirmada por el profesor: las publicaciones provienen de compañeros y pueden contener errores. El administrador puede corregirlas o retirarlas.

## Desarrollo, seguridad y pruebas

`npm run check` valida sintaxis y suite local. Se requiere probar **RLS sobre un proyecto escolar real**, entrega real Web Push, sesión, magic link, cron, pruebas visuales móvil y retención de datos antes de llamar al sistema «certificado». El resultado de CI verde no reemplaza esas pruebas.

No se necesitan créditos de IA. La infraestructura está sujeta a los límites de los niveles gratuitos de Supabase y Vercel; correo SMTP y uso adicional podrían requerir otro proveedor o plan.
