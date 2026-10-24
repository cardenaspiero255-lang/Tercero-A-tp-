import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/notify-post.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sql=read('supabase/portal-v2.sql'),extra=read('extras.mjs'),community=read('community.mjs'),app=read('app.js');
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(value){this.payload=value;return this}});

test('todas las herramientas sin IA están disponibles en navegación',()=>{
 for(const route of ['calendar','polls','materials','messages','stats'])assert.ok(app.includes(route),route);
 assert.match(extra,/renderExtraHub/);
 assert.match(community,/renderExtraHub\(\)/);
 assert.match(app,/renderPersonalSync/);
 assert.doesNotMatch(extra,/openai|gemini|claude|chatbot/i);
});
test('mensajes, perfiles y archivos bajo RLS obligatorio sin SELECT público',()=>{
 for(const table of ['portal_messages','portal_profiles','portal_materials','portal_polls','portal_poll_votes','portal_personal_state'])
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 assert.match(sql,/portal_dm_participants_read/);
 assert.match(sql,/portal_personal_read/);
 assert.match(sql,/portal_storage_member_read/);
 assert.match(sql,/portal_storage_member_upload/);
 assert.match(sql,/storage\.buckets\(id,name,public,file_size_limit/);
 assert.doesNotMatch(sql,/create policy portal_dm_participants_read[\s\S]{0,220}using\s*\(\s*true\s*\)/i);
});
test('votación única por cuenta y agregación sin exponer voto individual',()=>{
 assert.match(sql,/primary key\(poll_id,user_id\)/);
 assert.match(sql,/portal_votes_self_read/);
 assert.match(sql,/portal_poll_results/);
 assert.match(sql,/closes_at/);
});
test('notificaciones inmediatas se disparan solo tras guardar una publicación nueva',()=>{
 assert.match(community,/createdId/);
 assert.match(community,/\/api\/notify-post/);
 assert.match(sql,/primary key\(post_id,subscription_id\)/);
 assert.match(sql,/portal_claim_event_push_jobs/);
});
test('notify-post rechaza métodos y funciones desactivadas',async()=>{
 const badMethod=response();
 await handler({method:'GET',headers:{}},badMethod);
 assert.equal(badMethod.statusCode,405);
 const old=process.env.PORTAL_FEATURE_ACTIVE;
 try{process.env.PORTAL_FEATURE_ACTIVE='false';const bad=response();await handler({method:'POST',headers:{},body:{}},bad);assert.equal(bad.statusCode,503)}
 finally{if(old===undefined)delete process.env.PORTAL_FEATURE_ACTIVE;else process.env.PORTAL_FEATURE_ACTIVE=old}
});
test('sincronización no realiza borrados automáticos ni expone tokens',()=>{
 assert.match(read('extras-sync.mjs'),/confirm\(/);
 assert.match(read('extras-sync.mjs'),/sanitizePersonalSnapshot/);
 assert.match(sql,/portal_personal_state/);
 assert.match(sql,/portal_visit_self_insert/);
});
