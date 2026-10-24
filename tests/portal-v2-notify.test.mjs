import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/notify-post.js';

const vars=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','CRON_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','PORTAL_FEATURE_ACTIVE'];
const postId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
const createResponse=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}});
async function withServerConfig(action){
 const before=Object.fromEntries(vars.map(k=>[k,process.env[k]])),previousFetch=globalThis.fetch;
 Object.assign(process.env,{
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_only',
  CRON_SECRET:'A'.repeat(64),
  VAPID_PUBLIC_KEY:'fake_public',
  VAPID_PRIVATE_KEY:'fake_private',
  PORTAL_FEATURE_ACTIVE:'true'
 });
 try{await action()}finally{
  for(const k of vars){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]}
  globalThis.fetch=previousFetch;
 }
}
const request=body=>({method:'POST',headers:{authorization:'Bearer '+'T'.repeat(70)},body});
const ok=data=>({ok:true,json:async()=>data});

test('peticiones no JSON y sin token no revelan información',async()=>{
 await withServerConfig(async()=>{
  const bad=createResponse();await handler(request('{'),bad);assert.equal(bad.statusCode,400);
  const noAuth=createResponse();await handler({method:'POST',headers:{},body:{post_id:postId}},noAuth);assert.equal(noAuth.statusCode,401);
 });
});
test('solo el autor confirmado puede iniciar un aviso inmediato',async()=>{
 await withServerConfig(async()=>{
  let calledClaim=false;
  globalThis.fetch=async(url)=>{
   if(String(url).endsWith('/auth/v1/user'))return ok({id:userId,email_confirmed_at:new Date().toISOString()});
   if(String(url).includes('/rest/v1/portal_posts'))return ok([]);
   if(String(url).includes('claim_event'))calledClaim=true;
   return ok([]);
  };
  const res=createResponse();await handler(request({post_id:postId}),res);
  assert.equal(res.statusCode,403);
  assert.equal(calledClaim,false);
 });
});
test('publicación propia confirmada, sin suscriptores nuevos: éxito sin enviar datos al usuario',async()=>{
 await withServerConfig(async()=>{
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
   calls.push({url:String(url),method:options.method||'GET'});
   if(String(url).endsWith('/auth/v1/user'))return ok({id:userId,email_confirmed_at:new Date().toISOString()});
   if(String(url).includes('/portal_posts?'))return ok([{id:postId,kind:'exam',title:'Matemáticas',subject:'Matemática',created_by:userId,created_at:new Date().toISOString()}]);
   if(String(url).includes('/rpc/portal_claim_event_push_jobs'))return ok([]);
   throw new Error('Ruta externa inesperada: '+String(url));
  };
  const res=createResponse();await handler(request({post_id:postId}),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.sent,0);
  assert.equal(calls.filter(x=>x.url.includes('claim_event')).length,1);
  assert.equal(JSON.stringify(res.payload).includes('subscription'),false);
 });
});
