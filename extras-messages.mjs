import {validateMessage,validateDisplayName} from './extras-core.mjs';
import {E,API,R,member,user,locked,msg,localDate} from './extras-ui.mjs';
let profiles=[],messages=[],chatTo='';
export async function load(){
 if(!member())return;
 const uid=user().id;
 const [p,m]=await Promise.all([
  API('/rest/v1/portal_profiles?select=user_id,display_name&order=display_name.asc&limit=120',{authenticated:true}),
  API(`/rest/v1/portal_messages?select=id,sender_id,recipient_id,body,sent_at&or=(sender_id.eq.${uid},recipient_id.eq.${uid})&order=sent_at.desc&limit=150`,{authenticated:true})
 ]);
 profiles=p||[];messages=m||[];
}
export function setRecipient(id){
 if(id&&!profiles.some(p=>p.user_id===id&&p.user_id!==user()?.id))throw Error('Elige un compañero válido');
 chatTo=id;R();
}
export function render(){
 if(!member())return locked();
 const self=profiles.find(p=>p.user_id===user()?.id);
 const people=profiles.filter(p=>p.user_id!==user()?.id);
 const recipient=people.find(p=>p.user_id===chatTo);
 const conversation=messages.filter(m=>(m.sender_id===user()?.id&&m.recipient_id===chatTo)||(m.recipient_id===user()?.id&&m.sender_id===chatTo)).sort((a,b)=>a.sent_at.localeCompare(b.sent_at));
 return `<div class="page-head"><h1>✉️ Mensajes privados</h1><p class="sub">Conversaciones entre estudiantes registrados. No tienen cifrado de extremo a extremo: no compartas información sensible.</p></div>
 <div class="grid columns"><section class="panel"><h2>Tu perfil</h2><form id="extraProfileForm" class="form"><label>Nombre visible en el curso<input name="display_name" minlength="2" maxlength="40" value="${E(self?.display_name||'')}" required></label><button class="btn">Guardar nombre</button></form>
 <label class="portal-select-label">Conversar con<select id="extraChatTo"><option value="">Seleccionar compañero</option>${people.map(p=>`<option value="${E(p.user_id)}" ${chatTo===p.user_id?'selected':''}>${E(p.display_name)}</option>`).join('')}</select></label>
 <p class="small-label">Solo aparecen compañeros que iniciaron sesión y tienen perfil. Puedes reportar mensajes inapropiados.</p></section>
 <section class="panel"><h2>${recipient?'Conversación con '+E(recipient.display_name):'Conversaciones'}</h2>
 <div class="portal-chat-log" aria-live="polite">${conversation.map(m=>`<div class="portal-bubble ${m.sender_id===user()?.id?'mine':'theirs'}"><p>${E(m.body)}</p><span>${localDate(m.sent_at)}</span>${m.sender_id!==user()?.id?`<button type="button" class="btn btn-sm" data-extra-action="report" data-id="${E(m.id)}">Reportar</button>`:''}</div>`).join('')||'<p class="small-label">Selecciona un compañero para comenzar.</p>'}</div>
 ${recipient?`<form id="extraMessageForm" class="form"><input type="hidden" name="recipient" value="${E(recipient.user_id)}"><label>Mensaje<textarea name="body" required maxlength="500"></textarea></label><button class="btn btn-primary">Enviar mensaje</button></form>`:''}
 <button class="btn" data-extra-action="reload">Actualizar mensajes</button></section></div>`;
}
export async function profile(form){
 const name=validateDisplayName(new FormData(form).get('display_name'));
 await API('/rest/v1/portal_profiles?on_conflict=user_id',{method:'POST',authenticated:true,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{user_id:user().id,display_name:name}});
 await load();R();msg('Nombre guardado ✓');
}
export async function send(form){
 const d=new FormData(form);
 const record=validateMessage({sender:user().id,recipient:d.get('recipient'),body:d.get('body')});
 await API('/rest/v1/portal_messages',{method:'POST',authenticated:true,body:record});
 await load();R();msg('Mensaje enviado');
}
export async function report(id){
 const found=messages.find(m=>m.id===id&&m.recipient_id===user()?.id);
 if(!found)throw Error('Solo puedes reportar mensajes recibidos');
 const reason=prompt('Describe el motivo del reporte (mínimo 5 caracteres):');
 if(reason===null)return;
 const text=reason.trim().slice(0,300);
 if(text.length<5||/[<>]/.test(text))throw Error('Escribe un motivo válido de al menos 5 caracteres');
 await API('/rest/v1/portal_message_reports',{method:'POST',authenticated:true,body:{message_id:id,reporter_id:user().id,reason:text}});
 msg('Reporte enviado al administrador');
}