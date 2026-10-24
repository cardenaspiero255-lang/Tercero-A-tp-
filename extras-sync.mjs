import {sanitizePersonalSnapshot} from './extras-core.mjs';
import {API,member,user,msg,localDate} from './extras-ui.mjs';
export function render(){
 if(!member())return `<section class="panel"><h2>☁️ Sincronización entre dispositivos</h2><p>Inicia sesión como integrante del curso para guardar una copia privada de tus tareas y apuntes.</p><button class="btn" data-page="community">Iniciar sesión →</button></section>`;
 return `<section class="panel"><h2>☁️ Copia personal en la nube</h2><p class="small-label">Puedes transferir tus tareas, evaluaciones y apuntes entre dispositivos usando la misma cuenta. Para no perder cambios, tú eliges cuándo subir o recuperar datos.</p><div class="community-actions">
 <button class="btn btn-primary" data-extra-action="sync-upload">Subir mis datos</button><button class="btn" data-extra-action="sync-download">Recuperar en este dispositivo</button></div>
 <p class="small-label">No se suben contraseñas, sesiones ni mensajes privados. La descarga reemplaza los registros locales después de pedirte confirmación.</p></section>`;
}
export async function upload(){
 if(!member())throw Error('Únete al curso antes de sincronizar');
 const local=window.PortalPersonal?.get?.();
 if(!local)throw Error('No se encontraron datos locales');
 if(!confirm('¿Subir tu copia personal? Si ya existe otra copia en la nube, se reemplazará.'))return;
 const data=sanitizePersonalSnapshot(local);
 await API('/rest/v1/portal_personal_state?on_conflict=user_id',{method:'POST',authenticated:true,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{user_id:user().id,data}});
 msg('Copia privada guardada en Supabase ✓');
}
export async function download(){
 if(!member())throw Error('Únete al curso antes de sincronizar');
 const entries=await API('/rest/v1/portal_personal_state?select=data,updated_at&user_id=eq.'+encodeURIComponent(user().id),{authenticated:true});
 if(!entries?.length)throw Error('No tienes ninguna copia en la nube; primero súbela desde tu dispositivo original.');
 const date=localDate(entries[0].updated_at);
 if(!confirm('La copia de '+date+' reemplazará tus tareas, evaluaciones, enlaces y apuntes actuales en este dispositivo. ¿Continuar?'))return;
 const safe=sanitizePersonalSnapshot(entries[0].data);
 window.PortalPersonal?.export?.();
 window.PortalPersonal?.replace?.(safe);
 msg('Datos recuperados ✓. Se descargó una copia de respaldo local.');
}