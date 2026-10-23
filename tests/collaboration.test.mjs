import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeDigest, daysToExam, validatePost, selectUpcoming } from '../collab-core.mjs';
import config from '../api/public-config.js';
import cron from '../api/reminders.js';
const read=p=>readFileSync(new URL('../'+p, import.meta.url),'utf8');

test('validatePost: compañeros pueden publicar exámenes futuros y avisos',()=>{
 const exam=validatePost({kind:'exam',title:'Prueba de Lenguaje',subject:'Lenguaje',due_at:'2026-11-15T12:00:00Z',description:'capítulos 1 a 3'},new Date('2026-10-23T12:00:00Z'));
 assert.equal(exam.title,'Prueba de Lenguaje');
 assert.equal(exam.kind,'exam');
 assert.deepEqual(Object.keys(exam).sort(),['description','due_at','kind','subject','title']);
 assert.equal(validatePost({kind:'notice',title:'Traer materiales',description:'Una cartulina'},new Date()).due_at,null);
});
test('validatePost: rechaza XSS, entradas inválidas, fechas pasadas y títulos largos',()=>{
 assert.throws(()=>validatePost({kind:'exam',title:'<script>alert(1)</script>',subject:'Lenguaje',due_at:'2026-11-15T12:00:00Z'},new Date('2026-10-23T12:00:00Z')));
 assert.throws(()=>validatePost({kind:'exam',title:'Matemática',due_at:'2020-01-01T00:00:00Z'},new Date('2026-10-23T12:00:00Z')));
 assert.throws(()=>validatePost({kind:'notice',title:'x'.repeat(121)},new Date()));
 assert.throws(()=>validatePost({kind:'script',title:'ejemplo'},new Date()));
});
test('daysToExam respeta calendario de Chile y cambio de día',()=>{
 assert.equal(daysToExam('2026-11-15T14:00:00Z','2026-11-12T16:00:00Z'),3);
 assert.equal(daysToExam('2026-11-15T14:00:00Z','2026-11-15T23:00:00Z'),0);
 assert.equal(daysToExam('2026-11-15T14:00:00Z','2026-11-16T16:00:00Z'),-1);
});
test('selectUpcoming excluye pasado, avisos, eliminados y limita a próximos 30 días',()=>{
 const now='2026-10-23T12:00:00Z';
 const posts=[{id:'a',kind:'exam',subject:'Lenguaje',title:'Prueba',due_at:'2026-10-26T13:00:00Z',is_deleted:false},{id:'b',kind:'exam',title:'Antigua',due_at:'2026-10-15T13:00:00Z'},{id:'c',kind:'notice',title:'Aviso'},{id:'d',kind:'exam',title:'Muy lejos',due_at:'2027-05-01T13:00:00Z'},{id:'e',kind:'exam',title:'Oculta',due_at:'2026-10-28T13:00:00Z',is_deleted:true}];
 assert.deepEqual(selectUpcoming(posts,now).map(x=>x.id),['a']);
});
test('makeDigest arma notificación diaria sin correos ni IDs de usuarios',()=>{
 const v=makeDigest([{id:'a',kind:'exam',title:'Prueba',subject:'Lenguaje',due_at:'2026-10-26T13:00:00Z'}],'2026-10-23T12:00:00Z');
 assert.match(v.body,/Faltan 3 días/);assert.match(v.body,/Lenguaje/);
 assert.ok(v.title.length<100);
});
test('API pública nunca devuelve secretos ni configuraciones inventadas',()=>{
 const old={...process.env};
 try {process.env.SUPABASE_URL='';process.env.SUPABASE_PUBLISHABLE_KEY='';process.env.VAPID_PUBLIC_KEY='';process.env.SUPABASE_SECRET_KEY='secret-should-not-leak';
 const result={statusCode:200,headers:{},body:null,status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}};
 config({method:'GET'},result);assert.equal(result.body.enabled,false);assert.ok(!JSON.stringify(result.body).includes('secret-should-not-leak'));
 }finally{process.env=old}
});
test('cron exige secreto antes de tocar base de datos',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='the-cron-secret';
 try {const r={statusCode:200,body:null,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};await cron({method:'GET',headers:{}},r);assert.equal(r.statusCode,401)}finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old}
});
test('service worker escucha push y abre URL del portal',()=>{const sw=read('sw.js');assert.match(sw,/addEventListener\('push'/);assert.match(sw,/notificationclick/);});
test('migración contiene RLS para escritura por alumnos y actualización por administrador',()=>{const sql=read('supabase/portal.sql');assert.match(sql,/enable row level security/i);assert.match(sql,/for insert\s+to authenticated/i);assert.match(sql,/for update\s+to authenticated/i);assert.match(sql,/portal_roles/);assert.doesNotMatch(sql,/grant\s+insert\s+on\s+public\.portal_roles\s+to\s+authenticated/i)});

test('reclamación de administrador exige token y correo verificado configurado',async()=>{
 const {default:claim}=await import('../api/claim-admin.js');
 const old={...process.env};
 try{process.env.PORTAL_ADMIN_EMAIL='';const r={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this},setHeader(){}};
 await claim({method:'POST',headers:{}},r);assert.ok([401,503].includes(r.statusCode));assert.equal(r.body.admin,undefined);
 }finally{process.env=old}
});
test('unión al curso rechaza código incorrecto y no escribe en base de datos',async()=>{
 const {default:join}=await import('../api/join.js');
 const old=process.env.CLASSROOM_INVITE_CODE;process.env.CLASSROOM_INVITE_CODE='private-admin-code';
 try{const r={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this},setHeader(){}};
 await join({method:'POST',headers:{authorization:'Bearer anything'},body:{code:'wrong'}},r);assert.equal(r.statusCode,403);
 }finally{if(old===undefined)delete process.env.CLASSROOM_INVITE_CODE;else process.env.CLASSROOM_INVITE_CODE=old}
});
test('la clave secreta nunca se transmite como bearer ni se coloca en archivos de cliente',()=>{
 const service=['api/reminders.js','api/join.js','api/claim-admin.js'].map(read).join('\n');
 assert.doesNotMatch(service,/Authorization:`Bearer \$\{key\}`/);
 for(const file of ['community.mjs','app.js','index.html'])assert.doesNotMatch(read(file),/SUPABASE_SECRET_KEY|VAPID_PRIVATE_KEY|CRON_SECRET|CLASSROOM_INVITE_CODE/);
});
test('client incluye interfaz de publicaciones, edición de administrador e inicio de sesión',()=>{
 const source=read('community.mjs');assert.match(source,/courseNewForm/);assert.match(source,/courseEditForm/);assert.match(source,/courseJoinForm/);assert.match(source,/courseLoginForm/);assert.match(source,/subscribe\(/);
});

test('push backend usa exportaciones nombradas de web-push 3.6.7, sin default import inexistente',()=>{
 const script=read('api/reminders.js');
 assert.doesNotMatch(script,/\{default:webpush\}/);
 assert.match(script,/import\('web-push'\)/);
});
