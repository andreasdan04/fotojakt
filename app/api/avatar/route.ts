import {stripImageMetadata} from '@/lib/image-privacy';
import {member,origin,one,run,bucket,wrap,json,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member();if(Number(req.headers.get('content-length')||0)>2200000)fail('Profilbildet er for stort.');
 const form=await req.formData();const file=form.get('photo');if(!(file instanceof File)||file.type!=='image/jpeg'||file.size<100||file.size>2000000)fail('Velg et bilde under 2 MB.');
 const bytes=stripImageMetadata(await file.arrayBuffer(),file.type),sig=bytes;if(sig[0]!==255||sig[1]!==216||sig[2]!==255)fail('Ugyldig bilde.');
 const old=await one('SELECT key FROM avatars WHERE user=?',m.id),key='avatars/'+crypto.randomUUID()+'.jpg',updated=Date.now();
 await bucket().put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 try{await run('INSERT INTO avatars(user,key,updated) VALUES (?,?,?) ON CONFLICT(user) DO UPDATE SET key=excluded.key,updated=excluded.updated',m.id,key,updated)}catch(e){await bucket().delete(key);throw e}
 if(old)try{await bucket().delete(old.key)}catch{await run('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)','deleted-photo:'+old.key,old.key)}
 return json({ok:true,updated});
});
