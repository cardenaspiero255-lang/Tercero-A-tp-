const CACHE='portal-3a-web-v2';
const PUBLIC_ASSETS=['./','./index.html','./styles.css','./app.js','./community.mjs','./collab-core.mjs','./icon.svg','./manifest.webmanifest'];
const NAMES=new Set(PUBLIC_ASSETS.slice(1).map(s=>s.slice(2)));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC_ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('portal-3a-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||r.headers.has('Authorization'))return;
 const u=new URL(r.url);if(u.origin!==self.location.origin||u.search||u.pathname.includes('/api/'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('./index.html')));return;}
 const name=u.pathname.split('/').pop();if(!NAMES.has(name))return;
 e.respondWith(caches.match(r).then(c=>c||fetch(r).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(r,copy))}return resp})));
});

self.addEventListener('push',event=>{
 let message={title:'📚 Portal del curso',body:'Revisa los recordatorios de evaluaciones.',url:'/'};
 try{const data=event.data?.json();if(typeof data?.title==='string'&&typeof data?.body==='string')message={title:data.title.slice(0,120),body:data.body.slice(0,240),url:'/'};}catch{}
 event.waitUntil(self.registration.showNotification(message.title,{body:message.body,icon:'./icon.svg',badge:'./icon.svg',tag:'portal-examen-diario',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
   for(const client of clients){if(new URL(client.url).origin===self.location.origin){await client.focus();return;}}
   await self.clients.openWindow('/');
 }));
});
