import crypto from 'node:crypto';
const same=(a,b)=>{const x=Buffer.from(String(a).trim().toLowerCase()),y=Buffer.from(String(b).trim().toLowerCase());return Boolean(x.length&&y.length&&x.length===y.length&&crypto.timingSafeEqual(x,y))};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const desired=process.env.PORTAL_ADMIN_EMAIL;
 const auth=req.headers?.authorization||'';
 if(!auth.startsWith('Bearer ')||auth.length<22)return res.status(401).json({error:'Inicia sesión'});
 if(!desired||!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY||!process.env.SUPABASE_PUBLISHABLE_KEY)return res.status(503).json({error:'Falta configuración del administrador'});
 try{
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,pub=process.env.SUPABASE_PUBLISHABLE_KEY;
  const verify=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:auth}});
  if(!verify.ok)return res.status(401).json({error:'Sesión no válida'});
  const user=await verify.json();
  if(!user.email_confirmed_at||!same(user.email||'',desired))return res.status(200).json({admin:false});
  const inserted=await fetch(`${url}/rest/v1/portal_roles?on_conflict=user_id`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,role:'admin'})});
  if(!inserted.ok)throw Error('Base de datos no configurada');
  return res.status(200).json({admin:true});
 }catch{return res.status(503).json({error:'No se pudo verificar la cuenta de administrador'});}
}
