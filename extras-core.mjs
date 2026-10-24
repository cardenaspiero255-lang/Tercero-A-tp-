import {chileDay} from './collab-core.mjs';

const safeText=(value,max)=>String(value??'').trim().slice(0,max);
const unsafe=s=>/[<>]/.test(s);
const UUID=/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function buildMonthGrid(year,month,items=[]){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw Error('Mes inválido');
 const pad=n=>String(n).padStart(2,'0');
 const first=new Date(Date.UTC(year,month-1,1));
 const mondayOffset=(first.getUTCDay()+6)%7;
 const start=new Date(Date.UTC(year,month-1,1-mondayOffset));
 const grouped=new Map();
 for(const item of items){
  if(!item?.due_at||!['exam','activity'].includes(item.kind))continue;
  let day;
  try{day=chileDay(item.due_at)}catch{continue}
  if(!grouped.has(day))grouped.set(day,[]);
  grouped.get(day).push(item);
 }
 return Array.from({length:42},(_,i)=>{
  const d=new Date(start.getTime()+i*86400000);
  const date=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  return {date,day:d.getUTCDate(),inMonth:d.getUTCMonth()+1===month,events:grouped.get(date)||[]};
 });
}
export function validatePoll({question,options,closes_at}={}){
 const title=safeText(question,120);
 if(title.length<5||unsafe(title))throw Error('Pregunta inválida');
 if(!Array.isArray(options)||options.length<2||options.length>5)throw Error('Necesitas entre 2 y 5 opciones');
 const clean=options.map(x=>safeText(x,100));
 if(clean.some(x=>x.length<1||unsafe(x)))throw Error('Opciones inválidas');
 if(new Set(clean.map(s=>s.toLocaleLowerCase('es'))).size!==clean.length)throw Error('Las opciones deben ser diferentes');
 let closing=null;
 if(closes_at){
  const d=new Date(closes_at);
  if(!Number.isFinite(d.valueOf())||d.getTime()<=Date.now())throw Error('Fecha de cierre inválida');
  closing=d.toISOString();
 }
 return {question:title,options:clean,closes_at:closing};
}
export function validateMessage({sender,recipient,body}={}){
 if(!UUID.test(String(sender))||!UUID.test(String(recipient)))throw Error('Destinatario inválido');
 if(sender===recipient)throw Error('No puedes enviarte mensajes contigo mismo');
 const content=safeText(body,501);
 if(!content||content.length>500)throw Error('El mensaje debe tener entre 1 y 500 caracteres');
 if(unsafe(content))throw Error('No se admite HTML');
 return {sender_id:sender,recipient_id:recipient,body:content};
}
export function validateDisplayName(name){
 const clean=safeText(name,40);
 if(clean.length<2||unsafe(clean)||/[\u0000-\u001f]/.test(clean))throw Error('Nombre visible inválido');
 return clean;
}
const types={
 pdf:['application/pdf'],
 doc:['application/msword'],
 docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
 txt:['text/plain'],
 png:['image/png'],
 jpg:['image/jpeg'],
 jpeg:['image/jpeg'],
};
export function validateStudyFile(file){
 const name=String(file?.name||'');
 const extension=name.split('.').pop().toLowerCase();
 if(!Object.hasOwn(types,extension)||!types[extension].includes(file?.type||''))throw Error('El tipo de archivo no está permitido');
 if(!Number.isFinite(file.size)||file.size<=0||file.size>5*1024*1024)throw Error('El archivo debe pesar hasta 5 MB');
 if(name.length>130||/[\/\\<>]/.test(name))throw Error('Nombre de archivo inválido');
 return {extension,mime:file.type,name};
}
const personalTypes=['tasks','exams','resources','notices'];
export function sanitizePersonalSnapshot(data={}){
 const clean={};
 for(const type of personalTypes){
  const list=Array.isArray(data[type])?data[type]:[];
  clean[type]=list.slice(0,300).map(item=>({
   id:safeText(item?.id,100),title:safeText(item?.title,120),
   subject:safeText(item?.subject,100),date:safeText(item?.date,40),
   done:!!item?.done,url:safeText(item?.url,2000),
   description:safeText(item?.description,1000)
  })).filter(item=>item.id&&item.title&&!unsafe(item.title+item.description));
 }
 clean.notes=safeText(data.notes,10000);
 clean.theme=data.theme==='light'?'light':'dark';
 return clean;
}
