import crypto from 'node:crypto';
import {makeDigest,selectUpcoming,chileDay} from '../collab-core.mjs';

function safeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!b)return false;
 const p=Buffer.from(a),q=Buffer.from(b);
 return p.length===q.length&&crypto.timingSafeEqual(p,q);
}
async function db(path,init={}){
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
 const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{apikey:key,'Content-Type':'application/json',...init.headers}});
 if(!response.ok)throw new Error(`Error de base de datos (${response.status})`);
 const body=await response.text();return body?JSON.parse(body):null;
}
export default async function handler(req,res){
 res.setHeader?.('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
 const expected=process.env.CRON_SECRET;
 if(!safeEqual(req.headers?.authorization,`Bearer ${expected||''}`)||!expected)return res.status(401).json({error:'No autorizado'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return res.status(503).json({error:'Servicio no configurado'});
 try{
  const posts=await db('portal_posts?select=id,kind,title,subject,due_at,is_deleted&kind=eq.exam&is_deleted=eq.false&order=due_at.asc&limit=200');
  const digest=makeDigest(posts||[],new Date());
  if(!digest)return res.status(200).json({sent:0,reason:'Sin evaluaciones próximas'});
  const subscriptions=await db('portal_push_subscriptions?select=id,subscription&limit=500');
  const date=chileDay(new Date());
  const webpush=await import('web-push');
  webpush.setVapidDetails('https://tercero-a-tp.vercel.app',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  let sent=0,failed=0;
  // At-most-once per subscriber and Chile calendar day; duplicates are ignored by the database.
  for(const item of subscriptions||[]){
   if(!item.subscription?.endpoint)continue;
   const logged=await db('portal_delivery_log?on_conflict=subscription_id,local_day',{
     method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({subscription_id:item.id,local_day:date})
   });
   if(!Array.isArray(logged)||!logged.length)continue;
   try {await webpush.sendNotification(item.subscription,JSON.stringify(digest),{TTL:86400});sent++;}
   catch(err){failed++;if([404,410].includes(err.statusCode))await db(`portal_push_subscriptions?id=eq.${encodeURIComponent(item.id)}`,{method:'DELETE'});}
  }
  return res.status(200).json({sent,failed,exams:selectUpcoming(posts||[],new Date()).length});
 }catch(e){return res.status(500).json({error:'Falló la ejecución diaria; revisar los registros del servidor'});}
}
