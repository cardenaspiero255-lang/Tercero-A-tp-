const safeValue=v=>typeof v==='string'?v.trim():'';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
 const url=safeValue(process.env.SUPABASE_URL);
 const publishableKey=safeValue(process.env.SUPABASE_PUBLISHABLE_KEY);
 const vapidPublicKey=safeValue(process.env.VAPID_PUBLIC_KEY);
 const safeOrigin=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url);
 const safeKey=publishableKey.startsWith('sb_publishable_') || (publishableKey.startsWith('eyJ')&&publishableKey.length>80);
 // A preview must stay disabled until the database is initialized and email sign-in is usable.
 const enabled=Boolean(safeOrigin&&safeKey&&process.env.PORTAL_FEATURE_ACTIVE==='true');
 const pushEnabled=enabled&&Boolean(vapidPublicKey&&process.env.VAPID_PRIVATE_KEY&&process.env.CRON_SECRET);
 return res.status(200).json({enabled,supabaseUrl:enabled?url:'',publishableKey:enabled?publishableKey:'',pushEnabled,vapidPublicKey:pushEnabled?vapidPublicKey:''});
}
