import {all,one,db} from './server';
export async function hydrateChatMedia(rows:any[]){
 if(!rows.length)return;
 const ids=rows.map(r=>r.id),attachments=await all(`SELECT id,message,name,mime,size FROM chat_attachments WHERE message IN (${ids.map(()=>'?').join(',')}) ORDER BY created,id`,...ids);
 const photos=await all(`SELECT x.id message,s.id,s.caption,c.title,m.name FROM chat_messages x JOIN submissions s ON s.id=x.shared_photo JOIN challenges c ON c.id=s.challenge JOIN members m ON m.id=s.user WHERE x.id IN (${ids.map(()=>'?').join(',')}) AND m.status='approved' AND c.end<=?`,...ids,Date.now());
 for(const row of rows){row.attachments=attachments.filter((a:any)=>a.message===row.id);row.photo=photos.find((p:any)=>p.message===row.id)||null;row.sharedUnavailable=!!row.sharedPhoto&&!row.photo;}
}
export async function flaggedChatMessage(message:string){return one("SELECT message FROM chat_reviews WHERE message=? AND status IN ('flagged','manual','dismissed','confirmed')",message);}
// Internal SQL fragments only; called before deleting the selected messages.
export function chatCleanupStatements(where:string,args:any[]){const d=db(),messages='SELECT id FROM chat_messages WHERE '+where;return [
 d.prepare(`INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:chat:'||id,key FROM chat_attachments WHERE message IN (${messages})`).bind(...args),
 d.prepare(`DELETE FROM chat_attachments WHERE message IN (${messages})`).bind(...args),
 d.prepare(`DELETE FROM chat_reviews WHERE message IN (${messages})`).bind(...args)
 ];}
