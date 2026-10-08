import {stripImageMetadata} from '@/lib/image-privacy';
import {member,admin,origin,one,all,run,bucket,wrap,json,fail,str} from '@/lib/server';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{await admin(req);const rows=await all("SELECT key,value FROM settings WHERE key LIKE 'bug-report:%' ORDER BY key DESC LIMIT 200");return json({reports:rows.map((r:any)=>{try{return JSON.parse(r.value)}catch{return null}}).filter(Boolean)})});
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member();if(Number(req.headers.get('content-length')||0)>2400000)fail('Vedlegget er for stort.');
 const form=await req.formData(),now=Date.now();const last=await one('SELECT value FROM settings WHERE key=?','bug-last:'+m.id);if(Number(last?.value)>now-60000)fail('Vent ett minutt før du sender en ny rapport.',429);
 const description=str(form.get('description'),1500),page=String(form.get('page')||'').slice(0,80),id=now+'-'+crypto.randomUUID();let imageKey='';
 const file=form.get('photo');if(file instanceof File&&file.size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2000000||file.size<12)fail('Velg et JPG-, PNG- eller WebP-bilde under 2 MB.');const bytes=stripImageMetadata(await file.arrayBuffer(),file.type),s=bytes;const valid=file.type==='image/jpeg'?s[0]===255&&s[1]===216&&s[2]===255:file.type==='image/png'?s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71:s[0]===82&&s[1]===73&&s[2]===70&&s[3]===70&&s[8]===87&&s[9]===69&&s[10]===66&&s[11]===80;if(!valid)fail('Ugyldig bilde.');imageKey='bugs/'+id;await bucket().put(imageKey,bytes,{httpMetadata:{contentType:file.type}});}
 const report={id,user:m.id,username:m.username,name:m.name,description,page,created:now,imageKey,resolved:false};
 try{await run('INSERT INTO settings(key,value) VALUES (?,?)','bug-report:'+id,JSON.stringify(report));await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','bug-last:'+m.id,String(now));}catch(e){if(imageKey)await bucket().delete(imageKey);throw e}
 return json({ok:true});
});
export const PATCH=wrap(async(req:Request)=>{origin(req);await admin(req);const b:any=await req.json(),key='bug-report:'+str(b.id,100),row=await one('SELECT value FROM settings WHERE key=?',key);if(!row)fail('Rapporten finnes ikke.',404);const report=JSON.parse(row.value);report.resolved=b.resolved===true;report.resolvedAt=report.resolved?Date.now():null;await run('UPDATE settings SET value=? WHERE key=?',JSON.stringify(report),key);return json({ok:true})});
