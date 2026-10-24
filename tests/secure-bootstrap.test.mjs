import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../api/public-config.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const response=()=>({statusCode:200,body:null,status(n){this.statusCode=n;return this;},setHeader(){},json(v){this.body=v;return this;}});

test('client claims administrator and joins through authenticated school-only RPC, never Vercel privileged endpoints',()=>{
 const source=read('community.mjs');
 assert.match(source,/\/rest\/v1\/rpc\/portal_claim_admin/);
 assert.match(source,/\/rest\/v1\/rpc\/portal_join_course/);
 assert.doesNotMatch(source,/\/api\/(claim-admin|join)/);
});
test('public config remains off unless explicitly enabled and uses no Supabase service key',()=>{
 const before={...process.env};
 try{
  process.env.SUPABASE_URL='https://xvoaddorhezxddyaomsu.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fakeforunit';
  process.env.PORTAL_ADMIN_EMAIL='admin@example.com';
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.PORTAL_FEATURE_ACTIVE;
  let r=response();config({method:'GET'},r);
  assert.equal(r.body.enabled,false);
  process.env.PORTAL_FEATURE_ACTIVE='true';
  r=response();config({method:'GET'},r);
  assert.equal(r.body.enabled,true);
  assert.doesNotMatch(JSON.stringify(r.body),/SECRET_KEY|CRON_SECRET|CLASSROOM_INVITE_CODE/);
 }finally{process.env=before}
});
test('scheduled notifications use secret-checked stored procedures, not client-visible subscription tables',()=>{
 const source=read('api/reminders.js');
 assert.match(source,/rpc\/portal_claim_daily_push_jobs/);
 assert.match(source,/rpc\/portal_remove_dead_subscription/);
 assert.doesNotMatch(source,/SUPABASE_SECRET_KEY/);
 assert.doesNotMatch(source,/portal_delivery_log\?on_conflict/);
});
test('school bootstrap protects privileged routines and records only secret hashes in a private schema',()=>{
 const schema=read('supabase/secure-bootstrap.sql');
 assert.match(schema,/create schema if not exists portal_private/i);
 assert.match(schema,/sha256/i);
 assert.match(schema,/security definer/i);
 assert.match(schema,/email_confirmed_at/i);
 assert.match(schema,/revoke all on function public\.portal_claim_admin\(\) from public, anon, authenticated/i);
 assert.match(schema,/grant execute on function public\.portal_claim_admin\(\) to authenticated/i);
 assert.match(schema,/revoke all on function public\.portal_claim_daily_push_jobs/i);
 assert.doesNotMatch(schema,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});
