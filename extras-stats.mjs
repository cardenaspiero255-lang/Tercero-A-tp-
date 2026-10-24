import {E,API,R,admin,locked,msg} from './extras-ui.mjs';
let metrics=null,reports=[];
export async function load(){
 if(!admin())return;
 const [m,r]=await Promise.all([
  API('/rest/v1/rpc/portal_admin_metrics',{method:'POST',body:{},authenticated:true}),
  API('/rest/v1/portal_message_reports?select=id,reason,created_at,resolved&resolved=eq.false&order=created_at.desc&limit=30',{authenticated:true})
 ]);
 metrics=m||{};reports=r||[];
}
export function render(){
 if(!admin())return locked();
 const items=[['Compañeros inscritos',metrics?.members],['Perfiles configurados',metrics?.profiles],['Publicaciones',metrics?.posts],['Encuestas',metrics?.polls],['Votos',metrics?.votes],['Mensajes enviados',metrics?.messages],['Materiales compartidos',metrics?.materials],['Visitas últimos 7 días',metrics?.visits_7d],['Visitas hoy',metrics?.daily_visitors],['Reportes pendientes',metrics?.pending_reports]];
 return `<div class="page-head"><h1>📊 Estadísticas del curso</h1><p class="sub">Panel exclusivo del administrador. Se muestran totales, nunca mensajes privados ni votos individuales.</p></div>
 <section class="panel"><div class="portal-metrics">${items.map(([title,n])=>`<div class="portal-metric"><strong>${n===undefined?'—':Number(n)}</strong><span>${E(title)}</span></div>`).join('')}</div>
 <p class="small-label">Las visitas se cuentan una vez por alumno autenticado y día; no se incluyen visitantes anónimos ni se identifican alumnos individualmente.</p>
 <button class="btn" data-extra-action="reload">Actualizar</button></section>
 ${reports.length?`<section class="panel"><h2>⚑ Reportes pendientes</h2>${reports.map(r=>`<article class="portal-material"><span>${E(r.reason)}</span><button class="btn btn-sm" data-extra-action="resolve-report" data-id="${E(r.id)}">Marcar como revisado</button></article>`).join('')}</section>`:''}`;
}
export async function resolveReport(id){
 if(!admin())throw Error('Solo administrador');
 await API('/rest/v1/portal_message_reports?id=eq.'+encodeURIComponent(id),{method:'PATCH',authenticated:true,body:{resolved:true}});
 await load();R();msg('Reporte revisado');
}