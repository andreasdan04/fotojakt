import {all,one,run,member,admin,origin,wrap,json,fail,str} from '@/lib/server';
export const dynamic='force-dynamic';
async function roomAccess(room:string,user:string){
 if(room==='public')return{name:'Felles chat',canModerate:false};
 const g=await one('SELECT g.name,g.owner,gm.role FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?',room,user);if(!g)fail('Du har ikke tilgang til denne gruppechatten.',403);return{name:g.name,canModerate:g.owner===user||g.role==='admin'};
}
export const GET=wrap(async(req:Request)=>{
 const m=await member(),q=new URL(req.url).searchParams,room=q.get('room')||'public',access=await roomAccess(str(room,100),m.id);let canModerate=access.canModerate;if(room==='public'){try{await admin(req);canModerate=true}catch{}}
 const groups=await all('SELECT g.id,g.name FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user=? ORDER BY g.name',m.id);
 const before=q.get('before');let cursor:{created:number,id:string}|null=null;if(before){const match=/^(\d{1,16}):([a-zA-Z0-9-]{1,100})$/.exec(before);if(!match||!Number.isSafeInteger(Number(match[1])))fail('Ugyldig side i chatten.');cursor={created:Number(match[1]),id:match[2]}}
 const messages=await all(`SELECT x.id,x.user,x.body,x.created,x.reply_to replyTo,m.name,(SELECT updated FROM avatars WHERE user=m.id) avatarVersion FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.room=? AND m.status='approved'${cursor?' AND (x.created<? OR (x.created=? AND x.id<?))':''} ORDER BY x.created DESC,x.id DESC LIMIT 51`,room,...(cursor?[cursor.created,cursor.created,cursor.id]:[]));const hasMore=messages.length>50,rows=messages.slice(0,50).reverse();
 if(rows.length){
  const ids=rows.map((x:any)=>x.id),slots=ids.map(()=>'?').join(','),replyIds=[...new Set(rows.map((x:any)=>x.replyTo).filter(Boolean))];
  const reactions=await all(`SELECT r.message,r.emoji,COUNT(*) count,MAX(CASE WHEN r.user=? THEN 1 ELSE 0 END) mine FROM chat_reactions r JOIN members m ON m.id=r.user WHERE r.message IN (${slots}) AND m.status='approved' GROUP BY r.message,r.emoji ORDER BY r.emoji`,m.id,...ids);
  const replies=replyIds.length?await all(`SELECT x.id,x.body,m.name FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id IN (${replyIds.map(()=>'?').join(',')}) AND x.room=? AND m.status='approved'`,...replyIds,room):[];
  for(const row of rows){row.reply=replies.find((x:any)=>x.id===row.replyTo)||null;row.reactions=reactions.filter((x:any)=>x.message===row.id)}
 }
 return json({room,name:access.name,groups,canModerate,messages:rows,hasMore,nextBefore:rows.length?rows[0].created+':'+rows[0].id:null});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member(),b:any=await req.json(),room=str(b.room,100),access=await roomAccess(room,m.id);
 if(b.action==='delete'){
  const id=str(b.id,100),message=await one('SELECT user FROM chat_messages WHERE id=? AND room=?',id,room);if(!message)fail('Meldingen finnes ikke.',404);
  if(message.user!==m.id&&!access.canModerate){if(room!=='public')fail('Du kan bare slette egne meldinger.',403);await admin(req)}
  await run('DELETE FROM chat_reactions WHERE message=?',id);await run('DELETE FROM chat_messages WHERE id=? AND room=?',id,room);return json({ok:true});
 }
 if(b.action==='react'){
  const id=str(b.id,100),emoji=b.emoji;if(emoji!==null&&!['❤️','👍','😂','😮','😢','🎉'].includes(emoji))fail('Velg en gyldig reaksjon.');
  const target=await one("SELECT x.id FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id=? AND x.room=? AND m.status='approved'",id,room);if(!target)fail('Meldingen finnes ikke.',404);
  if(emoji===null)await run('DELETE FROM chat_reactions WHERE message=? AND user=?',id,m.id);
  else await run("INSERT INTO chat_reactions(message,user,emoji) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.id=? AND x.room=? AND a.status='approved') AND EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved') AND (?='public' OR EXISTS(SELECT 1 FROM group_members WHERE group_id=? AND user=?)) ON CONFLICT(message,user) DO UPDATE SET emoji=excluded.emoji",id,m.id,emoji,id,room,m.id,room,room,m.id);
  return json({ok:true});
 }
 if(b.action!=='send')fail('Ugyldig chatvalg.');const body=str(b.body,1500),id=typeof b.id==='string'?b.id:'';if(!/^[a-f0-9-]{36}$/i.test(id))fail('Ugyldig melding.');
 const replyTo=b.replyTo==null?null:str(b.replyTo,100);
 const existing=await one('SELECT user,room,body,reply_to FROM chat_messages WHERE id=?',id);if(existing){if(existing.user===m.id&&existing.room===room&&existing.body===body&&(existing.reply_to||null)===replyTo)return json({ok:true,id});fail('Meldingen er allerede brukt.',409)}
 if(replyTo&&!await one("SELECT x.id FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id=? AND x.room=? AND m.status='approved'",replyTo,room))fail('Meldingen du svarer på er ikke tilgjengelig.',404);
 // One message per second; a lost response can safely retry the same ID.
 const now=Date.now(),claimed=await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<=?','chat-rate:'+m.id,String(now+1000),now);if(!claimed.meta.changes)fail('Vent et øyeblikk før du sender neste melding.',429);
 const inserted=await run("INSERT OR IGNORE INTO chat_messages(id,room,user,body,created,reply_to) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved') AND (?='public' OR EXISTS(SELECT 1 FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?))",id,room,m.id,body,now,replyTo,m.id,room,room,m.id);if(!inserted.meta.changes){const saved=await one('SELECT user,room,body,reply_to FROM chat_messages WHERE id=?',id);if(saved?.user===m.id&&saved.room===room&&saved.body===body&&(saved.reply_to||null)===replyTo)return json({ok:true,id});fail('Tilgangen til chatten er endret. Last siden på nytt.',403)}return json({ok:true,id});
});
