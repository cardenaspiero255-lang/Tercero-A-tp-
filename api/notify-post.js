// One-off push for newly published class events. No service-role key is used.
// The caller's JWT is verified by Supabase, RLS verifies the author,
// and a server-only secret claims each recipient only once.
const POST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ready=()=>process.env.PORTAL_FEATURE_ACTIVE==='true'&&
 /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.SUPABASE_URL||'')&&
 (process.env.SUPABASE_PUBLISHABLE_KEY||'').startsWith('sb_publishable_')&&
 Boolean(process.env.CRON_SECRET&&process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);
async function db(path,{method='GET',body,auth}={}){
 const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/'+path,{method,headers:{
  apikey:process.env.SUPABASE_PUBLISHABLE_KEY,
  ...(auth?{Authorization:'Bearer '+auth}:{}),
  ...(body?{'Content-Type':'application/json'}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error('School REST '+response.status);
 return await response.json().catch(()=>null);
}
export default async function handler(req,res){
 res.setHeader?.('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Solo POST'});
 if(!ready())return res.status(503).json({error:'Avisos inmediatos no configurados'});
 const auth=req.headers?.authorization||'';
 if(!auth.startsWith('Bearer ')||auth.length<50)return res.status(401).json({error:'Inicio de sesión requerido'});
 const token=auth.slice(7);
 let raw;
 try{raw=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}}
 catch{return res.status(400).json({error:'JSON inválido'})}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({error:'Solicitud inválida'});
 if(!POST_ID.test(String(raw.post_id||'')))return res.status(400).json({error:'Publicación inválida'});
 try{
  const verify=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}});
  if(!verify.ok)return res.status(401).json({error:'Sesión no válida'});
  const user=await verify.json();
  if(!user?.id||!user?.email_confirmed_at)return res.status(403).json({error:'Correo no verificado'});
  const posts=await db('portal_posts?select=id,kind,title,subject,created_by,created_at&id=eq.'+raw.post_id+'&created_by=eq.'+user.id+'&is_deleted=eq.false&limit=1',{auth:token});
  const post=posts?.[0];
  if(!post||Date.now()-new Date(post.created_at).getTime()>600000)return res.status(403).json({error:'Solo el autor puede avisar sobre publicaciones recientes'});
  const jobs=await db('rpc/portal_claim_event_push_jobs',{method:'POST',body:{p_token:process.env.CRON_SECRET,p_post:post.id}});
  if(!Array.isArray(jobs))throw Error('Invalid push job list');
  if(jobs.length===0)return res.status(200).json({sent:0,failed:0,reason:'Ninguna suscripción nueva'});
  const pushModule=await import('web-push');
  const webpush=pushModule.default||pushModule;
  webpush.setVapidDetails('mailto:cardenaspiero255@gmail.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const title=post.kind==='exam'?'📚 Nueva evaluación':post.kind==='activity'?'📌 Nueva actividad':'📢 Nuevo aviso';
  const payload=JSON.stringify({title,body:String(post.subject+': '+post.title).slice(0,190),url:'/#comunidad'});
  let sent=0,failed=0;
  for(let i=0;i<jobs.length;i+=12){
   const results=await Promise.allSettled(jobs.slice(i,i+12).map(async item=>{
    if(!item.subscription?.endpoint)throw Error('Invalid subscription');
    try{return await webpush.sendNotification(item.subscription,payload,{TTL:7200});}
    catch(e){
     if([404,410].includes(e.statusCode))await db('rpc/portal_remove_dead_subscription',{method:'POST',body:{p_token:process.env.CRON_SECRET,p_id:item.id}}).catch(()=>{});
     throw e;
    }
   }));
   for(const r of results)r.status==='fulfilled'?sent++:failed++;
  }
  return res.status(200).json({sent,failed,attempted:jobs.length});
 }catch(e){
  console.error('Immediate push failed',e?.message?.replace(/https?:\/\/\S+/g,'[url]').slice(0,80));
  return res.status(503).json({error:'Publicación guardada; avisos inmediatos no confirmados'});
 }
}
