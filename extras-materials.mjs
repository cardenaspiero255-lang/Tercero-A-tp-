import {validateStudyFile} from './extras-core.mjs';
import {E,C,API,R,member,admin,user,locked,msg} from './extras-ui.mjs';
let materials=[];
export async function load(){
 if(!member())return;
 materials=await API('/rest/v1/portal_materials?select=id,uploader_id,title,subject,file_name,object_path,size_bytes,created_at&order=created_at.desc&limit=100',{authenticated:true})||[];
}
export function render(){
 if(!member())return locked();
 return `<div class="page-head"><h1>📎 Archivos compartidos</h1><p class="sub">Guías y materiales de estudio, solo para integrantes registrados.</p></div>
 <div class="grid columns"><section class="panel"><h2>Biblioteca del curso</h2>${materials.map(m=>`<article class="portal-material"><div><strong>${E(m.title)}</strong><p class="small-label">${E(m.subject)} · ${E(m.file_name)} · ${Math.round(m.size_bytes/1024)} KB</p></div><div class="community-actions"><button class="btn btn-sm" data-extra-action="download" data-id="${E(m.id)}">Descargar</button>${admin()||m.uploader_id===user()?.id?`<button class="btn btn-sm" data-extra-action="remove-file" data-id="${E(m.id)}">Eliminar</button>`:''}</div></article>`).join('')||'<p>No hay materiales compartidos todavía.</p>'}<button class="btn" data-extra-action="reload">Actualizar archivos</button></section>
 <section class="panel"><h2>+ Compartir material</h2><form id="extraMaterialForm" class="form">
 <label>Título<input name="title" minlength="3" maxlength="120" required></label>
 <label>Asignatura<input name="subject" maxlength="100" required placeholder="Matemática"></label>
 <label>Archivo<input type="file" name="file" required accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"></label>
 <p class="small-label">PDF, Word (.doc/.docx), TXT o imágenes. Máximo 5 MB. No subas datos personales ni documentos con macros.</p>
 <button class="btn btn-primary">Compartir archivo</button></form></section></div>`;
}
export async function fileApi(path,options={}){
 const {state}=C();
 const response=await fetch(state.config.supabaseUrl+'/storage/v1'+path,{...options,headers:{apikey:state.config.publishableKey,Authorization:'Bearer '+state.session.access_token,...options.headers}});
 if(!response.ok)throw Error('Storage rechazó el archivo ('+response.status+'). Revisa los permisos o el tipo de archivo.');
 return response;
}
export async function submit(form){
 if(!member())throw Error('Únete al curso primero');
 const data=new FormData(form),file=data.get('file');
 const info=validateStudyFile(file);
 const title=String(data.get('title')||'').trim(),subject=String(data.get('subject')||'').trim();
 if(title.length<3||title.length>120||subject.length<1||subject.length>100||/[<>]/.test(title+subject))throw Error('Título o asignatura inválidos');
 const path=user().id+'/'+crypto.randomUUID()+'.'+info.extension;
 const location='/object/portal-study-files/'+path.split('/').map(encodeURIComponent).join('/');
 await fileApi(location,{method:'POST',headers:{'Content-Type':info.mime,'x-upsert':'false'},body:file});
 try{
  await API('/rest/v1/portal_materials',{method:'POST',authenticated:true,body:{uploader_id:user().id,title,subject,file_name:info.name,object_path:path,size_bytes:file.size}});
 }catch(err){
  await fileApi(location,{method:'DELETE'}).catch(()=>{});
  throw err;
 }
 await load();R();msg('Archivo compartido con el curso ✓');
}
export async function download(id){
 const item=materials.find(m=>m.id===id);
 if(!item)throw Error('No se encontró el archivo');
 const path=item.object_path.split('/').map(encodeURIComponent).join('/');
 const response=await fileApi('/object/sign/portal-study-files/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:90})});
 const result=await response.json(),signed=result.signedURL||result.signedUrl;
 if(typeof signed!=='string'||!signed.startsWith('/object/sign/portal-study-files/'))throw Error('No se pudo generar el enlace privado');
 const a=document.createElement('a');
 a.href=C().state.config.supabaseUrl+'/storage/v1'+signed;
 a.target='_self';a.click();
}
export async function remove(id){
 const item=materials.find(m=>m.id===id);
 if(!item||(!admin()&&item.uploader_id!==user()?.id))throw Error('No tienes permisos para borrar este archivo');
 if(!confirm('¿Eliminar este archivo compartido?'))return;
 const path=item.object_path.split('/').map(encodeURIComponent).join('/');
 await fileApi('/object/portal-study-files/'+path,{method:'DELETE'});
 await API('/rest/v1/portal_materials?id=eq.'+encodeURIComponent(id),{method:'DELETE',authenticated:true});
 await load();R();msg('Archivo retirado');
}