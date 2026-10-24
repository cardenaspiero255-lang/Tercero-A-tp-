import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldOfferNotificationWelcome} from '../collab-core.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const client=read('community.mjs'),styles=read('styles.css'),worker=read('sw.js');

test('muestra bienvenida en el primer acceso con permiso sin decidir',()=>{
 assert.equal(shouldOfferNotificationWelcome({enabled:true,pushEnabled:true,permission:'default',seen:false}),true);
 assert.equal(shouldOfferNotificationWelcome({enabled:true,pushEnabled:true,permission:'denied',seen:false}),true);
});
test('respeta el rechazo y la activación previa, sin acosar en cada visita',()=>{
 assert.equal(shouldOfferNotificationWelcome({enabled:true,pushEnabled:true,permission:'default',seen:true}),false);
 assert.equal(shouldOfferNotificationWelcome({enabled:true,pushEnabled:true,permission:'granted',seen:false}),false);
 assert.equal(shouldOfferNotificationWelcome({enabled:false,pushEnabled:true,permission:'default',seen:false}),false);
 assert.equal(shouldOfferNotificationWelcome({enabled:true,pushEnabled:false,permission:'default',seen:false}),false);
});
test('modal de bienvenida explica avisos y tiene dos opciones voluntarias',()=>{
 assert.match(client,/role="dialog"/);
 assert.match(client,/aria-modal="true"/);
 assert.match(client,/Activar notificaciones/);
 assert.match(client,/Ahora no/);
 assert.match(client,/notification-welcome-backdrop/);
 assert.match(styles,/notification-welcome-backdrop/);
});
test('el navegador solo pide permiso desde clic del usuario; jamás automáticamente al cargar',()=>{
 const handler=client.slice(client.indexOf('function showNotificationWelcome('),client.indexOf('function card(p)'));
 assert.match(handler,/addEventListener\('click'/);
 assert.match(handler,/Notification\.requestPermission\(\)/);
 assert.doesNotMatch(handler,/setInterval/);
 assert.match(client,/shouldOfferNotificationWelcome/);
});
test('permiso bloqueado explica cambiarlo en Chrome sin solicitarlo de nuevo',()=>{
 assert.match(client,/Notification\.permission\s*===\s*'denied'/);
 assert.match(client,/Permisos.*Notificaciones/s);
 assert.match(client,/Chrome/);
});
test('si se acepta sin estar en el curso, no se promete suscripción automática',()=>{
 assert.match(client,/if\s*\(state\.member\s*&&\s*state\.user\)/);
 assert.match(client,/inicia sesión/i);
});
test('la activación confirma suscripción solo después de guardar en Supabase',()=>{
 const start=client.indexOf('async function registerPushSubscription(');
 const end=client.indexOf('async function unsubscribe(',start);
 const code=client.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(code,/await api\('\/rest\/v1\/portal_push_subscriptions/);
});
test('caché PWA cambia de versión para que llegue el nuevo código a Android',()=>{
 assert.match(worker,/const CACHE='portal-3a-web-v4'/);
 assert.match(worker,/NETWORK_FIRST/);
});