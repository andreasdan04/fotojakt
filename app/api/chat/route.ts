import {all,one,run,db,member,admin,origin,wrap,json,fail,str} from '@/lib/server';
import {chatRooms,queueChat,publicChatRoom,chatReaders,hasRead} from '@/lib/chat-notifications';
import {requireChatRoom as roomAccess} from '@/lib/chat-access';
import {hydrateChatMedia,chatCleanupStatements} from '@/lib/chat-media';
import {sendChat} from '@/lib/chat-send';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{
 const m=await member(),q=new URL(req.url).searchParams;
 if(q.get('summary')==='1'){const groups=await chatRooms(m.id),publicRoom=await publicChatRoom(m.id);return json({groups,publicRoom,unread:groups.reduce((n:number,g:any)=>n+g.unread,0)+publicRoom.unread})}
 const room=q.get('room')||'public',access=await roomAccess(str(room,100),m.id);let canUpdate=false,canModerate=access.canModerate;if(room==='public'){try{await admin(req);canModerate=true;canUpdate=true}catch{}}
 const groups=await chatRooms(m.id);
 const before=q.get('before');let cursor:{created:number,id:string}|null=null;if(before){const match=/^(\d{1,16}):([a-zA-Z0-9-]{1,100})$/.exec(before);if(!match||!Number.isSafeInteger(Number(match[1])))fail('Ugyldig side i chatten.');cursor={created:Number(match[1]),id:match[2]}}
 let target:any=null;if(q.get('message')&&!before){target=await one("SELECT x.id,x.created FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id=? AND x.room=? AND m.status='approved'",str(q.get('message'),100),room);if(!target)fail('Meldingen finnes ikke lenger.',404);cursor={created:target.created,id:target.id};}
 const messages=await all(`SELECT x.id,x.user,x.body,x.created,x.reply_to replyTo,x.shared_photo sharedPhoto,x.update_title updateTitle,x.update_icon updateIcon,m.name,(SELECT updated FROM avatars WHERE user=m.id) avatarVersion FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.room=? AND m.status='approved'${cursor?' AND (x.created<? OR (x.created=? AND x.id'+(target?'<=':'<')+'?))':''} ORDER BY x.created DESC,x.id DESC LIMIT 51`,room,...(cursor?[cursor.created,cursor.created,cursor.id]:[]));const hasMore=messages.length>50,rows=messages.slice(0,50).reverse();
 if(rows.length){
  const ids=rows.map((x:any)=>x.id),slots=ids.map(()=>'?').join(','),replyIds=[...new Set(rows.map((x:any)=>x.replyTo).filter(Boolean))];
  const reactions=await all(`SELECT r.message,r.emoji,COUNT(*) count,MAX(CASE WHEN r.user=? THEN 1 ELSE 0 END) mine FROM chat_reactions r JOIN members m ON m.id=r.user WHERE r.message IN (${slots}) AND m.status='approved' GROUP BY r.message,r.emoji ORDER BY r.emoji`,m.id,...ids);
  const replies=replyIds.length?await all(`SELECT x.id,x.body,m.name FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id IN (${replyIds.map(()=>'?').join(',')}) AND x.room=? AND m.status='approved'`,...replyIds,room):[];
  for(const row of rows){row.reply=replies.find((x:any)=>x.id===row.replyTo)||null;row.reactions=reactions.filter((x:any)=>x.message===row.id)}
 }
 await hydrateChatMedia(rows);
 const readers=await chatReaders(room,m.id),mine=readers.find((r:any)=>r.id===m.id);
 for(const row of rows){row.unread=row.user!==m.id&&!hasRead(mine,row);if(room!=='public'||canUpdate)row.readBy=readers.filter((r:any)=>r.id!==row.user&&r.joined<=row.created&&hasRead(r,row)).map((r:any)=>({id:r.id,name:r.name}));}
 const publicRoom=await publicChatRoom(m.id);
 return json({room,name:access.name,groups:groups.filter((g:any)=>g.kind!=='friend'),friends:groups.filter((g:any)=>g.kind==='friend'),publicRoom,publicActivity:publicRoom.lastActivity,canModerate,canUpdate,messages:rows,target:target?.id||null,hasMore,nextBefore:rows.length?rows[0].created+':'+rows[0].id:null});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member(),b:any=await req.json(),room=str(b.room,100),access=await roomAccess(room,m.id);
 if(b.action==='report'){const id=str(b.id,100);if(!await one('SELECT id FROM chat_messages WHERE id=? AND room=?',id,room))fail('Meldingen finnes ikke.',404);await run("INSERT INTO chat_reviews(message,status,reason,created) VALUES(?,'manual','Rapportert av en deltaker.',?) ON CONFLICT(message) DO UPDATE SET status='manual',reason='Rapportert av en deltaker.',updated=excluded.created",id,Date.now());await run('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)','chat-report:'+id,JSON.stringify({user:m.id,created:Date.now()}));return json({ok:true});}
 if(b.action==='preferences'){
  if(room==='public'||room.startsWith('dm:')||typeof b.enabled!=='boolean')fail('Velg en gyldig gruppeinnstilling.');
  await run('UPDATE group_members SET chat_notifications=? WHERE group_id=? AND user=?',b.enabled?1:0,room,m.id);return json({ok:true});
 }
 if(b.action==='read'){
  const id=str(b.id,100),message=await one("SELECT x.created,x.id FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.id=? AND x.room=? AND a.status='approved'",id,room);if(!message)fail('Meldingen finnes ikke.',404);
  if(room==='public'||room.startsWith('dm:')){await run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE json_extract(value,'$.created')<? OR (json_extract(value,'$.created')=? AND json_extract(value,'$.id')<?)",'dm-read:'+m.id+':'+room,JSON.stringify({created:message.created,id}),message.created,message.created,id);return json({ok:true});}
  await run('UPDATE group_members SET read_created=?,read_id=? WHERE group_id=? AND user=? AND (read_created<? OR (read_created=? AND read_id<?))',message.created,id,room,m.id,message.created,message.created,id);return json({ok:true});
 }
 if(b.action==='delete'){
  const id=str(b.id,100),message=await one('SELECT user FROM chat_messages WHERE id=? AND room=?',id,room);if(!message)fail('Meldingen finnes ikke.',404);
  if(message.user!==m.id&&!access.canModerate){if(room!=='public')fail('Du kan bare slette egne meldinger.',403);await admin(req)}
  await db().batch([...chatCleanupStatements('id=? AND room=?',[id,room]),db().prepare('DELETE FROM chat_push WHERE message=?').bind(id),db().prepare('DELETE FROM chat_reactions WHERE message=?').bind(id),db().prepare('DELETE FROM chat_messages WHERE id=? AND room=?').bind(id,room)]);return json({ok:true});
 }
 if(b.action==='react'){
  const id=str(b.id,100),emoji=b.emoji;if(emoji!==null&&!['❤️','👍','😂','😮','😢','🎉'].includes(emoji))fail('Velg en gyldig reaksjon.');
  const target=await one("SELECT x.id FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id=? AND x.room=? AND m.status='approved'",id,room);if(!target)fail('Meldingen finnes ikke.',404);
  if(emoji===null)await run('DELETE FROM chat_reactions WHERE message=? AND user=?',id,m.id);
  else if(room.startsWith('dm:'))await run("INSERT INTO chat_reactions(message,user,emoji) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM chat_messages WHERE id=? AND room=?) AND EXISTS(SELECT 1 FROM friendships f JOIN members a ON a.id=f.a JOIN members b ON b.id=f.b WHERE 'dm:'||f.a||':'||f.b=? AND (f.a=? OR f.b=?) AND f.status='accepted' AND a.status='approved' AND b.status='approved') ON CONFLICT(message,user) DO UPDATE SET emoji=excluded.emoji",id,m.id,emoji,id,room,room,m.id,m.id);
  else await run("INSERT INTO chat_reactions(message,user,emoji) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.id=? AND x.room=? AND a.status='approved') AND EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved') AND (?='public' OR EXISTS(SELECT 1 FROM group_members WHERE group_id=? AND user=?)) ON CONFLICT(message,user) DO UPDATE SET emoji=excluded.emoji",id,m.id,emoji,id,room,m.id,room,room,m.id);
  return json({ok:true});
 }
 if(b.action==='update'){if(room!=='public')fail('Oppdateringer publiseres i felleschatten.',403);await admin(req);return json(await sendChat({...b,photo:null,attachments:[],replyTo:null},m,room));}
 if(b.updateTitle!=null||b.updateIcon!=null)fail('Bruk admin-kommandoen /update.',403);
 if(b.action!=='send')fail('Ugyldig chatvalg.');return json(await sendChat(b,m,room));
});
