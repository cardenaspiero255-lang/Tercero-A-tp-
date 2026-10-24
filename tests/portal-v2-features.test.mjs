import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildMonthGrid, validatePoll, validateMessage, validateStudyFile,
 sanitizePersonalSnapshot, validateDisplayName
} from '../extras-core.mjs';

test('calendario: febrero bisiesto y meses con lunes como primer día',()=>{
 const feb=buildMonthGrid(2028,2,[]);
 assert.equal(feb.length,42);
 assert.equal(feb.filter(x=>x.inMonth).length,29);
 assert.equal(feb.find(x=>x.date==='2028-02-01').inMonth,true);
 const nov=buildMonthGrid(2027,11,[{id:'ex1',kind:'exam',title:'Prueba',due_at:'2027-11-04T14:00:00Z'}]);
 assert.equal(nov[0].date,'2027-11-01');
 assert.equal(nov.find(x=>x.date==='2027-11-04').events[0].title,'Prueba');
});
test('encuestas: hasta cinco opciones válidas, rechaza duplicados y HTML',()=>{
 assert.equal(validatePoll({question:'¿Qué actividad?',options:['Deporte','Paseo']}).options.length,2);
 assert.throws(()=>validatePoll({question:'Pregunta',options:['Igual','igual']}),/diferentes/);
 assert.throws(()=>validatePoll({question:'<script>',options:['a','b']}),/inválid/);
 assert.throws(()=>validatePoll({question:'Pregunta',options:['Una']}),/opciones/);
});
test('mensajes: texto breve, sin HTML y destino distinto del remitente',()=>{
 const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
 assert.equal(validateMessage({sender:alice,recipient:bob,body:' Hola  '}).body,'Hola');
 assert.throws(()=>validateMessage({sender:alice,recipient:alice,body:'Hola'}),/contigo/);
 assert.throws(()=>validateMessage({sender:alice,recipient:bob,body:'<img>'}),/HTML/);
 assert.throws(()=>validateMessage({sender:alice,recipient:bob,body:'A'.repeat(501)}),/500/);
});
test('archivos: PDF, Word sin macros, PNG y TXT, tamaño 5 MiB',()=>{
 assert.equal(validateStudyFile({name:'Guía Ángulos.pdf',type:'application/pdf',size:200}).extension,'pdf');
 assert.equal(validateStudyFile({name:'guia.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:400}).extension,'docx');
 assert.throws(()=>validateStudyFile({name:'macro.docm',type:'application/vnd.ms-word.document.macroEnabled.12',size:500}),/tipo/);
 assert.throws(()=>validateStudyFile({name:'video.mp4',type:'video/mp4',size:20}),/tipo/);
 assert.throws(()=>validateStudyFile({name:'grande.pdf',type:'application/pdf',size:6*1024*1024}),/5 MB/);
 assert.throws(()=>validateStudyFile({name:'pdf.exe',type:'application/pdf',size:5}),/tipo/);
});
test('sincronización: solo campos personales sin tokens ni campos arbitrarios',()=>{
 const clean=sanitizePersonalSnapshot({tasks:[{id:'x',title:'Matemática',done:true}],notes:'ok',theme:'dark',session:{token:'x'},admin:true});
 assert.equal(clean.tasks[0].title,'Matemática');
 assert.equal(clean.notes,'ok');
 assert.equal(clean.admin,undefined);
 assert.equal(clean.session,undefined);
 assert.deepEqual(clean.exams,[]);
});
test('nombres visibles del chat son opt-in y no aceptan contenido ejecutable',()=>{
 assert.equal(validateDisplayName(' Estudiante 3A '),'Estudiante 3A');
 assert.throws(()=>validateDisplayName('<script>'),/nombre/i);
});
