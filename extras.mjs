import * as Calendar from './extras-calendar.mjs';
import * as Polls from './extras-polls.mjs';
import * as Materials from './extras-materials.mjs';
import * as Messages from './extras-messages.mjs';
import * as Stats from './extras-stats.mjs';
import * as Sync from './extras-sync.mjs';
import {E,C,R,API,member,admin,user,msg} from './extras-ui.mjs';
import {chileDay} from './collab-core.mjs';
const modules={calendar:Calendar,polls:Polls,materials:Materials,messages:Messages,stats:Stats};
const loaded={},loading={};
export function renderExtraHub(){
 return `<section class="panel portal-extra-hub"><h2>🧰 Herramientas del curso</h2><p class="small-label">Más funciones compartidas, sin inteligencia artificial.</p>
 <div class="portal-extra-links">${[['calendar','📆 Calendario mensual'],['polls','🗳️ Encuestas'],['materials','📎 Archivos compartidos'],['messages','✉️ Mensajes privados']].map(([route,label])=>`<button type="button" class="btn" data-page="${route}">${label} →</button>`).join('')}
 ${admin()?'<button type="button" class="btn" data-page="stats">📊 Estadísticas →</button>':''}</div></section>`;
}

export function renderExtra(route){
 if(!C()?.state?.config?.enabled)return '<section class="panel"><h2>Conectando con el curso...</h2><p>Esta sección requiere Supabase.</p></section>';
 return modules[route]?.render()||'<section class="panel"><h2>Sección desconocida</h2></section>';
}

export async function onExtraOpen(route,force=false){
 if(!C()?.state?.config?.enabled||!modules[route]||loading[route])return;
 if(!force&&loaded[route]&&Date.now()-loaded[route]<15000)return;
 if(route==='stats'&&!admin()||route!=='calendar'&&!member())return;
 loaded[route]=Date.now();loading[route]=true;
 try{await modules[route].load();R()}
 catch(err){msg(err.message||'No se pudo actualizar esta sección')}
 finally{loading[route]=false}
}

export async function onExtrasAuthenticated(){
 if(!member()||!user()?.id)return;
 const uid=user().id;
 const day=chileDay(new Date()),key=`portal-visit-v2:${uid}:${day}`;
 try{
  await API('/rest/v1/portal_profiles?on_conflict=user_id',{method:'POST',authenticated:true,headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{user_id:uid,display_name:'Compañero '+uid.slice(0,8)}});
 }catch{/* El perfil puede configurarse manualmente. */}
 try{
  if(localStorage.getItem(key)==='1')return;
  await API('/rest/v1/portal_daily_visits?on_conflict=user_id,visit_day',{method:'POST',authenticated:true,headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{user_id:uid,visit_day:day}});
  localStorage.setItem(key,'1');
 }catch{/* Modo sin conexión: no impedir inicio de sesión. */}
}

export async function handleSubmit(form){
 if(form.id==='extraPollForm')await Polls.submit(form);
 if(form.id==='extraMaterialForm')await Materials.submit(form);
 if(form.id==='extraMessageForm')await Messages.send(form);
 if(form.id==='extraProfileForm')await Messages.profile(form);
}

export async function handleAction(button){
 const action=button.dataset.extraAction,id=button.dataset.id;
 if(action==='month-prev')return Calendar.shift(-1);
 if(action==='month-next')return Calendar.shift(1);
 if(action==='vote')return Polls.vote(id,button.dataset.choice);
 if(action==='close-poll')return Polls.close(id);
 if(action==='download')return Materials.download(id);
 if(action==='remove-file')return Materials.remove(id);
 if(action==='report')return Messages.report(id);
 if(action==='resolve-report')return Stats.resolveReport(id);
 if(action==='sync-upload')return Sync.upload();
 if(action==='sync-download')return Sync.download();
 if(action==='reload'){
  const route=window.portalCurrentPage?.()||'';
  if(modules[route])return onExtraOpen(route,true);
 }
}

document.addEventListener('submit',async event=>{
 if(!['extraPollForm','extraMaterialForm','extraMessageForm','extraProfileForm'].includes(event.target?.id))return;
 event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]');
 if(button?.disabled)return;if(button)button.disabled=true;
 try{await handleSubmit(form)}catch(err){msg(err.message||'Error al guardar')}
 finally{if(button?.isConnected)button.disabled=false}
});
document.addEventListener('click',async event=>{
 const button=event.target?.closest?.('[data-extra-action]');if(!button)return;
 event.preventDefault();if(button.disabled)return;button.disabled=true;
 try{await handleAction(button)}catch(err){msg(err.message||'Error en la operación')}
 finally{if(button.isConnected)button.disabled=false}
});
document.addEventListener('change',event=>{
 if(event.target?.id==='extraChatTo')try{Messages.setRecipient(event.target.value)}catch(err){msg(err.message)}
});
export const renderPersonalSync=Sync.render;
