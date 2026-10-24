import crypto from 'node:crypto';
import {makeDigest,selectUpcoming,chileDay} from '../collab-core.mjs';

const equal=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
};
async function school(path,body){
 const base=process.env.SUPABASE_URL,apiKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 const response=await fetch(`${base}/rest/v1/${path}`,{
  ...(body?{method:'POST',body:JSON.stringify(body)}:{method:'GET'}),
  headers:{apikey:apiKey,'Content-Type':'application/json'},
 });
 if(!response.ok)throw new Error(`School API failed with status ${response.status}`);
 const text=await response.text();return text?JSON.parse(text):null;
}
export default async function handler(req,res){
 res.setHeader?.('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
 const expected=process.env.CRON_SECRET;
 if(!equal(req.headers?.authorization,`Bearer ${expected||''}`)||!expected)return res.status(401).json({error:'No autorizado'});
 if(process.env.PORTAL_FEATURE_ACTIVE!=='true'||!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY||!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)
  return res.status(503).json({error:'Servicio no configurado'});
 try{
  const posts=await school('portal_posts?select=id,kind,title,subject,due_at,is_deleted&kind=eq.exam&is_deleted=eq.false&order=due_at.asc&limit=200');
  const digest=makeDigest(posts||[],new Date());
  if(!digest)return res.status(200).json({sent:0,reason:'Sin evaluaciones próximas'});
  const date=chileDay(new Date());
  // Every job is reserved atomically in PostgreSQL before delivery. The secret never reaches a browser.
  const jobs=await school('rpc/portal_claim_daily_push_jobs',{p_token:expected,p_day:date});
  if(!Array.isArray(jobs))throw new Error('Invalid subscription response');
  const pushModule=await import('web-push');
  const webpush=pushModule.default||pushModule;
  webpush.setVapidDetails('mailto:cardenaspiero255@gmail.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  let sent=0,failed=0;
  for(const item of jobs){
   if(!item.subscription?.endpoint)continue;
   try {await webpush.sendNotification(item.subscription,JSON.stringify(digest),{TTL:86400});sent++;}
   catch(err){failed++;
    if([404,410].includes(err.statusCode))await school('rpc/portal_remove_dead_subscription',{p_token:expected,p_id:item.id});
   }
  }
  return res.status(200).json({sent,failed,exams:selectUpcoming(posts||[],new Date()).length});
 }catch{return res.status(500).json({error:'Falló la ejecución diaria; revisar los registros del servidor'});}
}
