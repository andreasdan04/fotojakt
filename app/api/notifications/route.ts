import {member,origin,wrap,json,run,fail} from '@/lib/server';
import {inboxItems,inboxSeen} from '@/lib/inbox';
export const dynamic='force-dynamic';
export const GET=wrap(async()=>{
 const user=await member(),items=await inboxItems(user.id),seen=new Set(await inboxSeen(user.id));
 const notifications=items.map(item=>({...item,unread:!seen.has(item.id)}));
 return json({items:notifications,unread:notifications.filter(item=>item.unread).length});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const user=await member(),body:any=await req.json();
 if(!Array.isArray(body.ids)||body.ids.length>150||body.ids.some((id:any)=>typeof id!=='string'||id.length>200))fail('Ugyldige varsler.');
 const available=new Set((await inboxItems(user.id)).map(item=>item.id));
 const ids=[...new Set([...await inboxSeen(user.id),...body.ids.filter((id:string)=>available.has(id))])].slice(-1500);
 await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','inbox_seen:'+user.id,JSON.stringify(ids));
 return json({ok:true});
});
