// Pure, browser- and Node-compatible classroom logic. All dates are calendar dates in Chile.
const CHILE_ZONE='America/Santiago';
export function chileDay(value){
  const d = new Date(value);
  if(!Number.isFinite(d.valueOf()))throw new Error('Fecha inválida');
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:CHILE_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function daysToExam(date,now=new Date()){
  const a=chileDay(date),b=chileDay(now);
  const utcDay=s=>Date.parse(`${s}T00:00:00Z`);
  return Math.round((utcDay(a)-utcDay(b))/86400000);
}
export function validatePost(raw,now=new Date()){
  const kind=String(raw.kind||'');
  if(!['exam','notice'].includes(kind))throw new Error('Tipo no permitido');
  const title=String(raw.title||'').trim();
  const subject=String(raw.subject||'General').trim()||'General';
  const description=String(raw.description||'').trim();
  if(title.length<3||title.length>120||subject.length>100||description.length>1000)throw new Error('Longitud inválida');
  // Reject markup instead of trying to sanitize it into a different title.
  if(/[<>]/.test(title+subject+description))throw new Error('No se admite código HTML');
  const due=kind==='exam'?new Date(raw.due_at):null;
  if(kind==='exam'&&(!Number.isFinite(due.valueOf())||due.getTime()<=new Date(now).getTime()))throw new Error('La evaluación debe tener una fecha futura');
  return {kind,title,subject,description,due_at:kind==='exam'?due.toISOString():null};
}
export function selectUpcoming(posts,now=new Date()){
  return posts.filter(p=>p.kind==='exam'&&!p.is_deleted&&p.due_at&&daysToExam(p.due_at,now)>=0&&daysToExam(p.due_at,now)<=30)
    .sort((a,b)=>a.due_at.localeCompare(b.due_at)).slice(0,3);
}
export function makeDigest(posts,now=new Date()){
  const top=selectUpcoming(posts,now);
  if(!top.length)return null;
  const first=top[0],n=daysToExam(first.due_at,now);
  const when=new Intl.DateTimeFormat('es-CL',{timeZone:CHILE_ZONE,day:'numeric',month:'long'}).format(new Date(first.due_at));
  const time=n===0?'¡Hoy es la evaluación!':n===1?'Falta 1 día':`Faltan ${n} días`;
  const body=`${time} para ${first.subject} (${when}). ${top.length>1?`Hay ${top.length-1} evaluación(es) más próximas. `:''}Estudia y revisa el portal del curso.`;
  return {title:'📚 Recordatorio de evaluaciones',body, url:'/'};
}
