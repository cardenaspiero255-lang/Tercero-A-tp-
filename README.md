# Portal 3.º Medio A TP — colaboración independiente

Portal escolar con horario, evaluaciones, avisos y recordatorios diarios. Su sistema colaborativo está en una **rama de prueba** y no modifica la web pública hasta completar las verificaciones de seguridad y autenticación.

## Base de datos exclusiva

Supabase: proyecto **Portal 3 Medio A TP**, referencia `xvoaddorhezxddyaomsu`, región São Paulo (sa-east-1). Independiente de GameHub Ultra y de los demás proyectos; nunca reutilizar credenciales ni aplicar este SQL a otra base. Costo inicial confirmado: **US$0 mensuales**, sujeto a límites del plan gratuito.

La migración de `supabase/portal.sql` ya se aplicó al proyecto escolar. Todas las cinco tablas tienen RLS habilitado. Los visitantes ven publicaciones; los alumnos con correo verificado y código de invitación pueden publicar directamente; solo el administrador confirmado puede corregir o retirar publicaciones ajenas.

## Configuración requerida antes de habilitar

Añadir en **Vercel → proyecto tercero-a-tp- → Environment Variables**, y nunca en GitHub:

- `SUPABASE_URL`: URL del proyecto Supabase escolar
- `SUPABASE_PUBLISHABLE_KEY`: clave publicable del **proyecto escolar**
- `SUPABASE_SECRET_KEY`: clave privada del proyecto escolar (solo lado servidor)
- `PORTAL_ADMIN_EMAIL`: correo del administrador **elegido y verificado**
- `CLASSROOM_INVITE_CODE`: código privado y aleatorio para compañeros
- `CRON_SECRET`: clave privada del cron diario
- `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`: claves propias de Web Push

`/api/public-config` mantendrá el sistema colaborativo **desactivado** hasta que existan los primeros cinco valores. No copiar claves de GameHub Ultra.

## Validación necesaria antes de fusionar

- Configurar URLs de redirección de Supabase Auth hacia el dominio real del portal.
- Configurar un SMTP propio o autenticación compatible. El proveedor de correo predeterminado de Supabase puede enviar invitaciones solo a miembros de la organización; no es apto para todos los estudiantes sin ajuste.
- Verificar un inicio de sesión real como administrador y otro como alumno.
- Probar que un alumno no pueda borrar, editar o crear administradores.
- Probar un envío Web Push real con consentimiento, manejo de cancelación y entrega diaria.
- Verificar que el Cron protegido no se puede invocar sin autorización.

El horario y el progreso local **siguen disponibles** cuando el módulo colaborativo está desactivado.

## Desarrollo

```bash
npm install
npm run check
```

El cron está definido en `vercel.json` como una tarea UTC diaria; Vercel Hobby no garantiza el minuto exacto de ejecución.
