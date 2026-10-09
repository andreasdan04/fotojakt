import {all,one,run,db} from './server';
import {STAFF_CHAT_ROOM,staffChatSummary,staffChatReaders} from './staff-chat';
export async function chatRooms(user:string){const groups=await all(`SELECT g.id,g.name,gm.chat_notifications notifications,
 (SELECT MAX(x.created) FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.room=g.id AND a.status='approved') lastActivity,
 (SELECT COUNT(*) FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.room=g.id AND a.status='approved' AND x.user!=gm.user AND x.created>=gm.joined AND (x.created>gm.read_created OR (x.created=gm.read_created AND x.id>gm.read_id))) unread,
 (SELECT x.id FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.room=g.id AND a.status='approved' AND x.user!=gm.user AND x.created>=gm.joined AND (x.created>gm.read_created OR (x.created=gm.read_created AND x.id>gm.read_id)) ORDER BY x.created DESC,x.id DESC LIMIT 1) latestId,
 (SELECT x.created FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.room=g.id AND a.status='approved' AND x.user!=gm.user AND x.created>=gm.joined ORDER BY x.created DESC,x.id DESC LIMIT 1) latestCreated
 FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user=? ORDER BY g.name`,user);
 const friends=await all(`SELECT 'dm:'||f.a||':'||f.b id,m.name,'friend' kind,
 (SELECT MAX(x.created) FROM chat_messages x JOIN members a ON a.id=x.user WHERE x.room='dm:'||f.a||':'||f.b AND a.status='approved') lastActivity,
 (SELECT COUNT(*) FROM chat_messages x WHERE x.room='dm:'||f.a||':'||f.b AND x.user=m.id AND (x.created>COALESCE(json_extract(r.value,'$.created'),0) OR (x.created=COALESCE(json_extract(r.value,'$.created'),0) AND x.id>COALESCE(json_extract(r.value,'$.id'),'')))) unread,
 (SELECT x.id FROM chat_messages x WHERE x.room='dm:'||f.a||':'||f.b AND x.user=m.id ORDER BY x.created DESC,x.id DESC LIMIT 1) latestId,
 (SELECT MAX(x.created) FROM chat_messages x WHERE x.room='dm:'||f.a||':'||f.b AND x.user=m.id) latestCreated
 FROM friendships f JOIN members m ON m.id=CASE WHEN f.a=? THEN f.b ELSE f.a END LEFT JOIN settings r ON r.key='dm-read:'||?||':dm:'||f.a||':'||f.b WHERE (f.a=? OR f.b=?) AND f.status='accepted' AND m.status='approved'`,user,user,user,user);
 const team=await staffChatSummary(user);
 const rooms=[...groups,...friends,...(team?[team]:[])].sort((a:any,b:any)=>(b.lastActivity||0)-(a.lastActivity||0)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 await attachChatPreviews(rooms);if(team){const room=rooms.find(r=>r.id===STAFF_CHAT_ROOM);if(room)room.lastActivity=room.lastMessage?.created||0;}return rooms;}
export async function attachChatPreviews(rooms:any[]){
 if(!rooms.length)return;
 const ids=rooms.map(g=>g.id),latest=await all(`SELECT * FROM (SELECT x.id,x.room,x.user,x.body,x.created,m.name,ROW_NUMBER() OVER(PARTITION BY x.room ORDER BY x.created DESC,x.id DESC) n FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.room IN (${ids.map(()=>'?').join(',')}) AND m.status='approved') WHERE n=1`,...ids);
 const noticeIds=rooms.map(g=>g.latestId).filter(Boolean),notices=noticeIds.length?await all(`SELECT x.id,x.user,x.body,m.name FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id IN (${noticeIds.map(()=>'?').join(',')}) AND m.status='approved'`,...noticeIds):[];
 const lastIds=latest.map((x:any)=>x.id),receipts=lastIds.length?await all(`WITH last AS (SELECT * FROM chat_messages WHERE id IN (${lastIds.map(()=>'?').join(',')})) SELECT x.id message,r.id,r.name FROM last x JOIN members r ON r.id!=x.user AND r.status='approved' LEFT JOIN group_members gm ON gm.group_id=x.room AND gm.user=r.id LEFT JOIN settings s ON s.key='dm-read:'||r.id||':'||x.room WHERE (x.room='public' OR (gm.user IS NOT NULL AND gm.joined<=x.created) OR EXISTS(SELECT 1 FROM friendships f WHERE 'dm:'||f.a||':'||f.b=x.room AND (f.a=r.id OR f.b=r.id) AND f.status='accepted')) AND (COALESCE(gm.read_created,json_extract(s.value,'$.created'),0)>x.created OR (COALESCE(gm.read_created,json_extract(s.value,'$.created'),0)=x.created AND COALESCE(gm.read_id,json_extract(s.value,'$.id'),'')>=x.id))`,...lastIds):[];
 const staffReceipts=rooms.some(g=>g.id===STAFF_CHAT_ROOM)?await staffChatReaders():[];
 for(const g of rooms){g.lastMessage=latest.find((x:any)=>x.room===g.id)||null;if(g.lastMessage)g.lastMessage.readBy=receipts.filter((r:any)=>r.message===g.lastMessage.id).map((r:any)=>({id:r.id,name:r.name}));if(g.id===STAFF_CHAT_ROOM&&g.lastMessage)g.lastMessage.readBy=staffReceipts.filter(r=>r.id!==g.lastMessage.user&&hasRead(r,g.lastMessage)).map(r=>({id:r.id,name:r.name}));g.notice=notices.find((x:any)=>x.id===g.latestId)||null;}
}
// Only call after authorizing the viewer's room access.
export async function chatReaders(room:string,user:string){
 if(room===STAFF_CHAT_ROOM)return staffChatReaders();
 if(room==='public'||room.startsWith('dm:'))return all(`SELECT m.id,m.name,0 joined,COALESCE(json_extract(r.value,'$.created'),0) readCreated,COALESCE(json_extract(r.value,'$.id'),'') readId FROM members m LEFT JOIN settings r ON r.key='dm-read:'||m.id||':'||? WHERE m.status='approved' AND (?='public' OR m.id IN (SELECT a FROM friendships WHERE 'dm:'||a||':'||b=? AND (a=? OR b=?) AND status='accepted' UNION SELECT b FROM friendships WHERE 'dm:'||a||':'||b=? AND (a=? OR b=?) AND status='accepted'))`,room,room,room,user,user,room,user,user);
 return all("SELECT m.id,m.name,gm.joined,gm.read_created readCreated,gm.read_id readId FROM group_members gm JOIN members m ON m.id=gm.user WHERE gm.group_id=? AND m.status='approved'",room);
}
export function hasRead(reader:any,message:any){return !!reader&&(reader.readCreated>message.created||(reader.readCreated===message.created&&reader.readId>=message.id));}
export async function publicChatRoom(user:string){
 const reader=await one("SELECT m.joined,COALESCE(json_extract(s.value,'$.created'),0) readCreated,COALESCE(json_extract(s.value,'$.id'),'') readId FROM members m LEFT JOIN settings s ON s.key='dm-read:'||m.id||':public' WHERE m.id=?",user);
 const notice=await one("SELECT x.id,x.user,x.body,x.created,m.name,COUNT(*) OVER() unread FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.room='public' AND m.status='approved' AND x.user!=? AND x.created>=? AND (x.created>? OR (x.created=? AND x.id>?)) ORDER BY x.created DESC,x.id DESC LIMIT 1",user,reader?.joined||0,reader?.readCreated||0,reader?.readCreated||0,reader?.readId||'');
 const room:any={id:'public',name:'Felles chat',unread:notice?.unread||0,latestId:notice?.id||null,latestCreated:notice?.created||0};await attachChatPreviews([room]);if(room.lastMessage)delete room.lastMessage.readBy;room.lastActivity=room.lastMessage?.created||0;return room;
}
export async function queueChat(message:string){const now=Date.now();await run(`INSERT OR IGNORE INTO chat_push(id,message,subscription,created,expires)
 SELECT 'chat:'||x.id||':'||p.id,x.id,p.id,?,? FROM chat_messages x JOIN group_members gm ON gm.group_id=x.room JOIN members m ON m.id=gm.user JOIN push_subscriptions p ON p.user=gm.user
 WHERE x.id=? AND x.room!='public' AND gm.user!=x.user AND gm.chat_notifications=1 AND m.status='approved' AND x.created>=gm.joined AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||gm.user AND off.value='1')`,now,now+86400000,message)}
export async function dispatchChat(send:(sub:any,payload:any,ttl:number)=>Promise<number>){const now=Date.now();await run('DELETE FROM chat_push WHERE expires<=?',now);const jobs=await all("SELECT * FROM chat_push WHERE status='pending' AND attempts<5 AND next_attempt<=? ORDER BY created LIMIT 20",now);let sent=0,failed=0;
 for(const job of jobs){const sub=await one(`SELECT p.*,g.id room,g.name groupName FROM push_subscriptions p JOIN members recipient ON recipient.id=p.user JOIN chat_messages x ON x.id=? JOIN members author ON author.id=x.user JOIN groups g ON g.id=x.room JOIN group_members gm ON gm.group_id=g.id AND gm.user=p.user
 WHERE p.id=? AND recipient.status='approved' AND author.status='approved' AND x.user!=p.user AND gm.chat_notifications=1 AND x.created>=gm.joined AND (x.created>gm.read_created OR (x.created=gm.read_created AND x.id>gm.read_id)) AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1')`,job.message,job.subscription);
  if(!sub){await run("UPDATE chat_push SET status='skipped' WHERE id=?",job.id);continue}
  try{const status=await send(sub,{title:'💬 '+sub.groupName,body:'Du har en ny melding i gruppechatten.',url:'/?chat='+encodeURIComponent(sub.room),tag:'chat:'+sub.room,kind:'chat',expires:job.expires},Math.floor((job.expires-Date.now())/1000));if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run("UPDATE chat_push SET status='expired' WHERE id=?",job.id)}else if(status>=200&&status<300){await run("UPDATE chat_push SET status='sent',attempts=attempts+1 WHERE id=?",job.id);sent++}else{await retry(job.id);failed++}}catch{await retry(job.id);failed++}
 }
 return {sent,failed};
}
async function retry(id:string){await run('UPDATE chat_push SET attempts=attempts+1,next_attempt=? WHERE id=?',Date.now()+60000,id)}
