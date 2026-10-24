import {validatePoll} from './extras-core.mjs';
import {E,API,R,member,admin,user,locked,msg} from './extras-ui.mjs';
let polls=[],myVotes=[],totals={};
export async function load(){
 if(!member())return;
 const [p,v]=await Promise.all([
  API('/rest/v1/portal_polls?select=id,question,options,closes_at,is_closed,created_by,created_at&order=created_at.desc&limit=20',{authenticated:true}),
  API('/rest/v1/portal_poll_votes?select=poll_id,user_id,choice',{authenticated:true})
 ]);
 polls=p||[];myVotes=v||[];
 const data=await Promise.all(polls.map(async poll=>{
  const rows=await API('/rest/v1/rpc/portal_poll_results',{method:'POST',authenticated:true,body:{p_poll_id:poll.id}});
  return [poll.id,Object.fromEntries((rows||[]).map(row=>[row.choice,Number(row.votes)]))];
 }));
 totals=Object.fromEntries(data);
}
export function render(){
 if(!member())return locked();
 const cards=polls.map(p=>{
  const mine=myVotes.find(v=>v.poll_id===p.id);
  const closed=p.is_closed||(p.closes_at&&new Date(p.closes_at).getTime()<=Date.now());
  const counts=totals[p.id]||{},total=Object.values(counts).reduce((a,b)=>a+Number(b),0);
  return `<article class="community-post"><h3>🗳️ ${E(p.question)}</h3><p class="small-label">${closed?'Cerrada':'Abierta'} · ${total} voto(s)${mine?' · Ya votaste':''}</p>
   ${(Array.isArray(p.options)?p.options:[]).map((opt,i)=>`<div class="portal-poll-choice"><span>${E(opt)} ${mine||closed?`· ${Number(counts[i]||0)} voto(s)`:''}</span>${!mine&&!closed?`<button class="btn btn-sm" data-extra-action="vote" data-id="${E(p.id)}" data-choice="${i}">Votar</button>`:''}</div>`).join('')}
   ${admin()&&!closed?`<button class="btn btn-sm" data-extra-action="close-poll" data-id="${E(p.id)}">Cerrar votación</button>`:''}</article>`;
 }).join('');
 return `<div class="page-head"><h1>🗳️ Encuestas del curso</h1><p class="sub">Una respuesta por cuenta, con resultados agregados.</p></div>
 <div class="grid columns"><section class="panel"><h2>Encuestas recientes</h2>${cards||'<p>No hay encuestas todavía.</p>'}<button class="btn" data-extra-action="reload">Actualizar</button></section>
 <section class="panel"><h2>+ Crear encuesta</h2><form class="form" id="extraPollForm"><label>Pregunta<input name="question" required minlength="5" maxlength="120"></label>
 ${[1,2,3,4].map(i=>`<label>Opción ${i}${i>2?' (opcional)':''}<input name="opt${i}" maxlength="100" ${i<=2?'required':''}></label>`).join('')}
 <label>Fecha de cierre (opcional)<input type="datetime-local" name="closes_at"></label><button class="btn btn-primary">Publicar encuesta</button></form></section></div>`;
}
export async function submit(form){
 const d=new FormData(form);
 const raw=validatePoll({question:d.get('question'),options:[1,2,3,4].map(i=>d.get('opt'+i)).filter(x=>String(x||'').trim()),closes_at:d.get('closes_at')});
 await API('/rest/v1/portal_polls',{authenticated:true,method:'POST',body:{...raw,created_by:user().id}});
 await load();R();msg('Encuesta publicada ✓');
}
export async function vote(id,choice){
 if(!member())throw Error('Únete al curso');
 await API('/rest/v1/portal_poll_votes',{method:'POST',authenticated:true,body:{poll_id:id,user_id:user().id,choice:Number(choice)}});
 await load();R();msg('Tu voto quedó registrado');
}
export async function close(id){
 if(!admin())throw Error('Solo el administrador puede cerrar encuestas');
 if(!confirm('¿Cerrar esta encuesta?'))return;
 await API('/rest/v1/portal_polls?id=eq.'+encodeURIComponent(id),{method:'PATCH',authenticated:true,body:{is_closed:true}});
 await load();R();msg('Encuesta cerrada');
}