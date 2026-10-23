import crypto from 'node:crypto';
function same(a,b){const p=Buffer.from(String(a)),q=Buffer.from(String(b));return p.length===q.length&&crypto.timingSafeEqual(p,q)}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const code=String(req.body?.code||'').trim();
 const jwt=req.headers?.authorization?.replace(/^Bearer /,'')||'';
 if(!process.env.CLASSROOM_INVITE_CODE||!same(code,process.env.CLASSROOM_INVITE_CODE)||!jwt)return res.status(403).json({error:'Código de curso incorrecto o sesión ausente'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,pub=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!pub)return res.status(503).json({error:'Servicio no configurado'});
 try{
  const verify=await fetch(`${url}/auth/v1/user`,{headers:{apikey:pub,Authorization:`Bearer ${jwt}`}});
  if(!verify.ok)return res.status(401).json({error:'Sesión no válida'});
  const user=await verify.json();
  if(!user.id||!user.email_confirmed_at)return res.status(403).json({error:'El correo debe estar verificado'});
  const write=await fetch(`${url}/rest/v1/portal_members?on_conflict=user_id`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id})});
  if(!write.ok)throw new Error('No se pudo inscribir');
  return res.status(200).json({joined:true});
 }catch{return res.status(500).json({error:'No se pudo completar la inscripción'});}
}
