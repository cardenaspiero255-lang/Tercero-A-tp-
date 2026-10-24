import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js');
const community=read('community.mjs');
const worker=read('sw.js');

test('la barra móvil enseña Comunidad directamente sin esconder Más',()=>{
  assert.match(app,/\['home','schedule','tasks','community','more'\]\.map\(renderLink\)/);
  assert.match(app,/function morePage\(\)[\s\S]*?data-page="exams"/);
});

test('al abrir #comunidad y volver del enlace email se abre Comunidad en vez de Inicio',()=>{
  assert.match(app,/function initialPage\(/);
  assert.match(app,/access_token=/);
  assert.match(app,/comunidad['"]?\s*:\s*['"]community/);
  assert.match(app,/let page\s*=\s*initialPage\(/);
});

test('aviso para activar notificaciones visible sin sesión, permiso solo al ser miembro',()=>{
  assert.match(community,/function notificationUI\(/);
  assert.match(community,/🔔 Notificaciones del curso/);
  assert.match(community,/notificationUI\(\)/);
  assert.match(community,/Inicia sesión|inicia sesión/);
  assert.match(community,/state\.member/);
  assert.match(community,/data-course-action="subscribe"/);
});

test('el service worker sale de cache v2 y da prioridad a scripts actuales',()=>{
  assert.match(worker,/const CACHE='portal-3a-web-v4'/);
  assert.match(worker,/self\.skipWaiting\(\)/);
  assert.match(worker,/fetch\(r\)[\s\S]*?caches\.match\(r\)/);
  assert.match(worker,/u\.pathname\.includes\('\/api\/'\)/);
  assert.match(worker,/Authorization/);
});

test('ruta inicial abre Comunidad con hash y con tokens de autenticación',()=>{
 const source=app.slice(app.indexOf('function initialPage('),app.indexOf('let state=load();'));
 const initialPage=new Function('window',`${source};return initialPage;`)({location:{hash:''}});
 assert.equal(initialPage('#comunidad'),'community');
 assert.equal(initialPage('#community'),'community');
 assert.equal(initialPage('#access_token=abc&refresh_token=def'),'community');
 assert.equal(initialPage('#tareas'),'tasks');
 assert.equal(initialPage(''),'home');
});

test('notificaciones piden inicio de sesión al visitante y permiten activación al administrador',()=>{
 const source=community.slice(community.indexOf('function notificationUI(){'),community.indexOf('function render(){'));
 const view=state=>new Function('state',`${source};return notificationUI();`)(state);
 const guest=view({user:null,member:false,config:{pushEnabled:true}});
 assert.match(guest,/Ir a iniciar sesión/);
 assert.doesNotMatch(guest,/data-course-action="subscribe"/);
 const admin=view({user:{email:'cardenaspiero255@gmail.com'},member:true,config:{pushEnabled:true}});
 assert.match(admin,/Activar notificaciones/);
 assert.match(admin,/data-course-action="subscribe"/);
 const noPush=view({user:{email:'cardenaspiero255@gmail.com'},member:true,config:{pushEnabled:false}});
 assert.doesNotMatch(noPush,/data-course-action="subscribe"/);
});
