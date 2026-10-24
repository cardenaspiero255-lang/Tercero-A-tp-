import {buildMonthGrid} from './extras-core.mjs';
import {E,C,R} from './extras-ui.mjs';
let year=new Date().getFullYear(),month=new Date().getMonth()+1;
export function render(){
 const posts=C()?.state?.posts||[];
 const local=window.PortalPersonal?.get?.()||{};
 const personals=[...(local.exams||[]).map(x=>({...x,kind:'exam',due_at:x.date,private:true})),...(local.tasks||[]).filter(x=>x.date).map(x=>({...x,kind:'activity',due_at:x.date,private:true}))];
 const grid=buildMonthGrid(year,month,[...posts,...personals]);
 const label=new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
 return `<div class="page-head"><h1>📆 Calendario escolar</h1><p class="sub">Pruebas y actividades compartidas junto con fechas personales.</p></div><section class="panel">
 <div class="portal-month-controls"><button class="btn" data-extra-action="month-prev">← Anterior</button><h2>${E(label)}</h2><button class="btn" data-extra-action="month-next">Siguiente →</button></div>
 <div class="portal-calendar" role="grid" aria-label="Calendario de ${E(label)}">
 ${['L','M','M','J','V','S','D'].map(x=>`<div class="portal-weekday">${x}</div>`).join('')}
 ${grid.map(d=>`<div class="portal-day ${d.inMonth?'':'outside'}" role="gridcell"><strong>${d.day}</strong>${d.events.slice(0,4).map(x=>`<div class="portal-event ${x.private?'private':''}" title="${E(x.title)}">${x.private?'🔒':x.kind==='exam'?'📚':'📌'} ${E(x.title)}</div>`).join('')}${d.events.length>4?`<span class="small-label">+${d.events.length-4} más</span>`:''}</div>`).join('')}</div>
 <p class="small-label">🔒 Las fechas personales solo se muestran en este dispositivo. Los demás eventos vienen de Comunidad.</p>
 <button class="btn" data-page="community">Publicar evaluación o actividad →</button>
 </section>`;
}
export function shift(by){
 let m=month+by;
 if(m<1){m=12;year--}else if(m>12){m=1;year++}
 month=m;R();
}
export async function load(){await C()?.loadPosts(true)}