import {validatePost,daysToExam,selectUpcoming} from './collab-core.mjs';
const SKEY='portal-3a-collab-session-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={config:null,posts:[],user:null,session:null,role:'visitor',member:false,loading:true,error:'',editId:null,lastLoad:0};
const notify=msg=>window.toast?.(msg);
const active=()=>state.config?.enabled===true;
function getSaved(){try{return JSON.parse(localStorage.getItem(SKEY)||'null')}catch{return null}}
function storeSession(v){state.session=v;try{v?localStorage.setItem(SKEY,JSON.stringify(v)):localStorage.removeItem(SKEY)}catch{}}
function saveTokens(raw){const expires=Number(raw.expires_in)||3600;storeSession({access_token:raw.access_token,refresh_token:raw.refresh_token,expires_at:Date.now()+expires*1000});}
function refreshUI(){if(typeof window.render==='function')window.render()}
async function api(path,options={}){
 if(!active())throw Error('Base de datos compartida aún no habilitada');
 const {method='GET',body,authenticated=false,headers={}}=options;
 if(authenticated)await freshSession();
 if(authenticated&&!state.session?.access_token)throw Error('Inicia sesión para publicar');
 const response=await fetch(`${state.config.supabaseUrl}${path}`,{method,headers:{apikey:state.config.publishableKey,...(authenticated?{Authorization:`Bearer ${state.session.access_token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 if(!response.ok){if(response.status===401)throw Error('Sesión vencida. Vuelve a entrar con tu correo.');if(response.status===403)throw Error('No tienes permisos para esta acción.');const b=await response.json().catch(()=>null);throw Error(b?.message||b?.error||`La conexión falló (${response.status})`)}
 const text=await response.text();return text?JSON.parse(text):null;
}
async function freshSession(){
 if(!state.session?.refresh_token)return;
 if(state.session.expires_at>Date.now()+60000)return;
 const response=await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:state.config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:state.session.refresh_token})});
 if(!response.ok){storeSession(null);state.user=null;state.member=false;state.role='visitor';return}
 saveTokens(await response.json());
}
async function loadIdentity(){
 state.user=null;state.member=false;state.role='visitor';
 if(!state.session?.access_token)return;
 await freshSession();if(!state.session)return;
 const response=await fetch(`${state.config.supabaseUrl}/auth/v1/user`,{headers:{apikey:state.config.publishableKey,Authorization:`Bearer ${state.session.access_token}`}});
 if(!response.ok){storeSession(null);return}
 state.user=await response.json();
 // The database verifies email ownership and assigns the admin role only to the designated address.
 await api('/rest/v1/rpc/portal_claim_admin',{method:'POST',body:{},authenticated:true}).catch(()=>false);
 const [roles,members]=await Promise.all([
 api(`/rest/v1/portal_roles?select=role&user_id=eq.${encodeURIComponent(state.user.id)}`,{authenticated:true}),
 api(`/rest/v1/portal_members?select=user_id&user_id=eq.${encodeURIComponent(state.user.id)}`,{authenticated:true})
 ]);
 state.role=roles?.[0]?.role==='admin'?'admin':'student';
 state.member=state.role==='admin'||Boolean(members?.length);
}
async function loadPosts(force=false){
 if(!active()||(Date.now()-state.lastLoad<20000&&!force))return;
 const list=await api('/rest/v1/portal_posts?select=id,kind,title,subject,description,due_at,created_at,is_deleted&is_deleted=eq.false&order=created_at.desc&limit=100');
 state.posts=Array.isArray(list)?list:[];state.lastLoad=Date.now();state.error='';refreshUI();
}
async function initialize(){
 try{
  const res=await fetch('/api/public-config',{cache:'no-store'});
  state.config=res.ok?await res.json():{enabled:false};
  if(!active())return;
  const hash=window.location.hash;
  if(hash.includes('access_token=')){
    const parts=new URLSearchParams(hash.replace(/^#/,''));
    if(parts.has('access_token')&&parts.has('refresh_token'))saveTokens({access_token:parts.get('access_token'),refresh_token:parts.get('refresh_token'),expires_in:parts.get('expires_in')});
    history.replaceState(null,'',window.location.pathname+window.location.search);
  }else storeSession(getSaved());
  await Promise.all([loadIdentity(),loadPosts(true)]);
 }catch(err){state.error=err.message||'No se pudo conectar al curso';}
 finally{state.loading=false;refreshUI()}
}
function card(p){
 const n=p.due_at&&p.kind==='exam'?daysToExam(p.due_at):null;
 const date=n===null?'':n===0?'Hoy':n===1?'Mañana':n>1?`Faltan ${n} días`:'Fecha pasada';
 const dateText=p.due_at?new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'America/Santiago'}).format(new Date(p.due_at)):'';
 const edit=state.role==='admin'&&state.editId===p.id;
 return `<article class="community-post"><div class="community-post-head"><span class="tag">${p.kind==='exam'?'📚 Evaluación':'📢 Aviso'}</span>${date?`<span class="tag">${esc(date)}</span>`:''}</div><h3>${esc(p.title)}</h3><p class="small-label">${esc(p.subject||'General')}${dateText?' · '+esc(dateText):''}</p>${p.description?`<p>${esc(p.description)}</p>`:''}${state.role==='admin'?`<div class="community-actions"><button class="btn btn-sm" data-course-edit="${esc(p.id)}">${edit?'Cancelar':'✎ Corregir'}</button><button class="btn btn-sm" data-course-delete="${esc(p.id)}">✕ Eliminar</button></div>`:''}${edit?form(p):''}</article>`;
}
function isoLocal(s){if(!s)return '';const d=new Date(s);if(!Number.isFinite(d.valueOf()))return '';const pad=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function form(post=null){
 const editing=Boolean(post),kind=post?.kind||'exam';
 return `<form id="${editing?'courseEditForm':'courseNewForm'}" ${editing?`data-id="${esc(post.id)}"`:''} class="form community-form">
 <label>Tipo<select name="kind"><option value="exam" ${kind==='exam'?'selected':''}>Evaluación</option><option value="notice" ${kind==='notice'?'selected':''}>Aviso</option></select></label>
 <label>Título<input name="title" required minlength="3" maxlength="120" value="${esc(post?.title||'')}" placeholder="Prueba de Lenguaje"></label>
 <label>Asignatura<select name="subject"><option value="General">General</option>${['Lenguaje','Matemática','Inglés','Filosofía','Educación Física','Ciencias para la Ciudadanía','CYPESDA','LDRDALCE','EYCDCY','LYEDSD','IYEDSD','Otra'].map(s=>`<option ${s===post?.subject?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
 <label>Fecha y hora (solo evaluaciones)<input name="due_at" type="datetime-local" value="${esc(isoLocal(post?.due_at))}"></label>
 <label>Descripción<textarea name="description" maxlength="1000" placeholder="Contenido de la evaluación, páginas a estudiar...">${esc(post?.description||'')}</textarea></label>
 <button type="submit" class="btn btn-primary">${editing?'Guardar corrección':'Publicar para todo el curso'}</button>
 </form>`;
}
function accountUI(){
 if(!state.user)return `<section class="panel"><h2>🔑 Participar como compañero</h2><p>Para publicar o recibir avisos diarios, entra con tu correo. Te enviamos un enlace de acceso; no hace falta contraseña.</p><form id="courseLoginForm" class="form"><label>Correo electrónico<input type="email" name="email" maxlength="254" required autocomplete="email" placeholder="tu-correo@ejemplo.cl"></label><button class="btn btn-primary" type="submit">Enviar enlace a mi correo</button></form><p class="small-label">Para evitar publicaciones de personas ajenas al curso, después necesitas el código de invitación del administrador.</p></section>`;
 const role=state.role==='admin'?'🛡️ Administrador':state.member?'✍️ Compañero colaborador':'👀 Visitante registrado';
 return `<section class="panel"><h2>${role}</h2><p class="small-label">Sesión: ${esc(state.user.email||'')} <button type="button" class="btn btn-sm" data-course-action="logout">Salir</button></p>
 ${!state.member?`<p>Para poder publicar, pide el código privado de invitación al administrador.</p><form id="courseJoinForm" class="form"><label>Código de curso<input name="code" type="password" required minlength="6" autocomplete="off" placeholder="Código compartido por tu curso"></label><button type="submit" class="btn btn-primary">Entrar al curso</button></form>`:''}
 ${state.member?`<h3>🔔 Recordatorios diarios</h3><p class="small-label">Puedes elegir recibir en este dispositivo un aviso diario cuando haya evaluaciones próximas. Las notificaciones no se activan automáticamente.</p>${state.config.pushEnabled?'<div class="community-actions"><button class="btn btn-primary" data-course-action="subscribe">Activar avisos diarios</button><button class="btn" data-course-action="unsubscribe">Desactivar en este dispositivo</button></div>':'<div class="local-banner">Los avisos automáticos estarán disponibles cuando se configuren las claves de notificaciones del servidor.</div>'}`:''}</section>`;
}
function render(){
 if(state.loading)return '<section class="panel"><h2>📚 Comunidad del curso</h2><p>Conectando...</p></section>';
 if(!active())return `<section class="panel"><h2>📚 Comunidad del curso</h2><div class="local-banner"><strong>La colaboración está preparada pero necesita una base de datos escolar independiente.</strong> El horario y las tareas personales continúan funcionando. Hasta activar esta conexión, nadie puede publicar avisos compartidos ni recibir notificaciones.</div></section>`;
 const upcoming=selectUpcoming(state.posts);
 return `<div class="page-head"><div class="eyebrow">EN COMÚN · 3° MEDIO A TP</div><h1>📚 Comunidad del curso</h1><p class="sub">Evaluaciones y avisos publicados directamente por tus compañeros. El administrador puede corregir o retirar cualquiera.</p></div>
 ${state.error?`<div class="local-banner">No se pudieron cargar todos los datos: ${esc(state.error)}</div>`:''}
 <div class="grid columns"><section class="panel"><div class="panel-head"><h2>◷ Próximas evaluaciones</h2><button class="btn btn-sm" data-course-action="refresh">Actualizar</button></div>${upcoming.length?upcoming.map(card).join(''):empty('No hay evaluaciones próximas','Cuando un compañero registre una prueba, aparecerá aquí.','◷')}</section>${accountUI()}</div>
 ${state.member?`<section class="panel"><h2>+ Publicar para el curso</h2><p class="small-label">Máximo 5 publicaciones por compañero cada 24 horas. Usa fechas verificadas.</p>${form()}</section>`:''}
 <section class="panel"><h2>Publicaciones compartidas</h2>${state.posts.length?state.posts.map(card).join(''):empty('Aún no hay publicaciones','Puedes ser el primero en ayudar al curso.','📚')}</section>`;
}
function preview(){
 if(!active()||!state.posts.length)return '';
 const exams=selectUpcoming(state.posts);
 if(!exams.length)return '';
 return `<section class="panel"><div class="panel-head"><h2>📚 Evaluaciones compartidas por el curso</h2><button type="button" class="btn btn-sm" data-page="community">Ver comunidad ↗</button></div>${exams.map(x=>`<div class="task-item"><div class="task-main"><strong>${esc(x.subject||'General')}: ${esc(x.title)}</strong><div class="small-label">${daysToExam(x.due_at)===0?'¡Hoy!':`Faltan ${daysToExam(x.due_at)} días`}</div></div></div>`).join('')}</section>`;
}
async function login(form){
 const email=String(new FormData(form).get('email')||'').trim();
 const redirect=window.location.origin+window.location.pathname+'#comunidad';
 const response=await fetch(`${state.config.supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',headers:{apikey:state.config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true})});
 if(!response.ok)throw Error('No se pudo enviar el enlace. Revisa el correo e inténtalo después.');
 notify('Revisa tu correo y abre el enlace de acceso');
}
async function join(form){
 const code=String(new FormData(form).get('code')||'').trim();await freshSession();
 const joined=await api('/rest/v1/rpc/portal_join_course',{method:'POST',body:{p_code:code},authenticated:true});
 if(joined!==true)throw Error('El código no es válido');
 await loadIdentity();refreshUI();notify('Ya puedes publicar para el curso ✓');
}
async function submitPost(form,edit=false){
 const d=new FormData(form);const raw={kind:d.get('kind'),title:d.get('title'),subject:d.get('subject'),description:d.get('description'),due_at:d.get('due_at')?new Date(String(d.get('due_at'))).toISOString():undefined};
 const item=validatePost(raw);
 if(edit){if(state.role!=='admin')throw Error('Solo el administrador puede editar');await api(`/rest/v1/portal_posts?id=eq.${encodeURIComponent(form.dataset.id)}`,{authenticated:true,method:'PATCH',body:item});state.editId=null}
 else {if(!state.member)throw Error('Necesitas unirte al curso');await api('/rest/v1/portal_posts',{method:'POST',authenticated:true,body:{...item,created_by:state.user.id}})}
 await loadPosts(true);notify(edit?'Publicación corregida':'Publicado para todo el curso ✓');
}
async function del(id){if(state.role!=='admin')throw Error('Sin permisos de administrador');if(!confirm('¿Retirar esta publicación de todo el curso?'))return;await api(`/rest/v1/portal_posts?id=eq.${encodeURIComponent(id)}`,{authenticated:true,method:'PATCH',body:{is_deleted:true}});await loadPosts(true);notify('Publicación retirada')}
function decodeVapid(key){const pad='='.repeat((4-key.length%4)%4);const str=atob((key+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(str,c=>c.charCodeAt(0))}
async function subscribe(){
 if(!state.member||!state.user)throw Error('Únete al curso primero');
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Este navegador no permite notificaciones web.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('No se concedió permiso para notificaciones.');
 const worker=await navigator.serviceWorker.ready;
 let sub=await worker.pushManager.getSubscription();if(!sub)sub=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(state.config.vapidPublicKey)});
 await api('/rest/v1/portal_push_subscriptions?on_conflict=user_id,endpoint',{method:'POST',authenticated:true,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{user_id:state.user.id,endpoint:sub.endpoint,subscription:sub.toJSON()}});
 notify('Recordatorios diarios activados en este dispositivo ✓');
}
async function unsubscribe(){
 if(!('serviceWorker'in navigator))return;
 const worker=await navigator.serviceWorker.ready, sub=await worker.pushManager.getSubscription();if(!sub){notify('No había avisos activos en este dispositivo');return}
 await api(`/rest/v1/portal_push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,{authenticated:true,method:'DELETE'});
 await sub.unsubscribe();notify('Notificaciones desactivadas');
}
document.addEventListener('submit',async event=>{
 if(!['courseLoginForm','courseJoinForm','courseNewForm','courseEditForm'].includes(event.target?.id))return;
 event.preventDefault();const form=event.target;const button=form.querySelector('[type=submit]');if(button)button.disabled=true;
 try{if(form.id==='courseLoginForm')await login(form);if(form.id==='courseJoinForm')await join(form);if(form.id==='courseNewForm')await submitPost(form);if(form.id==='courseEditForm')await submitPost(form,true)}catch(err){notify(err.message||'No se pudo completar la acción')}finally{if(button?.isConnected)button.disabled=false}
});
document.addEventListener('click',async event=>{
 const edit=event.target.closest('[data-course-edit]');if(edit){state.editId=state.editId===edit.dataset.courseEdit?null:edit.dataset.courseEdit;refreshUI();return}
 const remove=event.target.closest('[data-course-delete]');if(remove){try{await del(remove.dataset.courseDelete)}catch(e){notify(e.message)}return}
 const action=event.target.closest('[data-course-action]');if(!action)return;
 try{const a=action.dataset.courseAction;if(a==='refresh')await loadPosts(true);if(a==='subscribe')await subscribe();if(a==='unsubscribe')await unsubscribe();if(a==='logout'){if(state.session){await fetch(`${state.config.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:state.config.publishableKey,Authorization:`Bearer ${state.session.access_token}`}}).catch(()=>{});}storeSession(null);state.user=null;state.role='visitor';state.member=false;refreshUI();}}
 catch(err){notify(err.message||'No se pudo completar la acción')}
});
window.PortalCommunity={render,preview,onOpen(){loadPosts().catch(e=>{state.error=e.message;refreshUI()})}};
initialize();
setInterval(()=>{if(active()&&document.visibilityState==='visible'){loadPosts(true).catch(e=>{state.error=e.message})}},60000);
