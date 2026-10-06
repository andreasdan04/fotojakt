import {audienceSql,peerAudienceSql} from './groups';
import {all,one,run,db} from './server';
export async function notificationsEnabled(user:string){return (await one('SELECT value FROM settings WHERE key=?','push_disabled:'+user))?.value!=='1'}
export async function socialPreferences(user:string){const p=await one('SELECT comments,reactions,replies,friends,groups FROM notification_preferences WHERE user=?',user);return {comments:!!p?.comments,reactions:!!p?.reactions,replies:!!p?.replies,friends:p?.friends!==0,groups:p?.groups!==0}}
export async function queueSocial(kind:'comment'|'reaction',submission:string,actor:string,source:string){
 const now=Date.now(),column=kind==='comment'?'comments':'reactions';
 const subs=await all(`SELECT p.id FROM submissions s JOIN members m ON m.id=s.user JOIN notification_preferences n ON n.user=m.id JOIN push_subscriptions p ON p.user=m.id WHERE s.id=? AND s.user!=? AND m.status='approved' AND n.${column}=1 AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1')`,submission,actor);
 const day=new Date(now).toISOString().slice(0,10);
 const filtered=kind==='comment'?await filterCommentSubscribers(subs,source):subs;
 const statements=filtered.map((p:any)=>db().prepare('INSERT OR IGNORE INTO social_push(id,subscription,submission,actor,kind,source,created,expires) VALUES (?,?,?,?,?,?,?,?)').bind(kind+':'+p.id+':'+submission+':'+actor+':'+source+(kind==='reaction'?':'+day:''),p.id,submission,actor,kind,source,now,now+86400000));
 if(statements.length)await db().batch(statements);
 if(kind==='comment')await queueReply(submission,actor,source);
}
export async function dispatchSocial(sendPush:(sub:any,payload:any,ttl:number)=>Promise<number>){
 const now=Date.now();await run('DELETE FROM social_push WHERE expires<?',now);
 const jobs=await all("SELECT * FROM social_push WHERE status='pending' AND attempts<5 AND next_attempt<=? ORDER BY created LIMIT 20",now);let sent=0,failed=0;
 for(const job of jobs){
  const column=job.kind==='reply'?'replies':job.kind==='comment'?'comments':'reactions';
  const sub=await one(`SELECT p.*,a.name actor_name,s.challenge,c.season FROM push_subscriptions p JOIN members m ON m.id=p.user JOIN notification_preferences n ON n.user=m.id JOIN submissions s ON s.id=? JOIN challenges c ON c.id=s.challenge JOIN members a ON a.id=? WHERE p.id=? AND s.id=? AND m.status='approved' AND a.status='approved' AND p.user!=? AND n.${column}=1 AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1') AND ${audienceSql(job.actor,'s.user')} AND ${audienceSqlForRecipient()} AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=p.user)) AND ${job.kind==='reply'?"EXISTS(SELECT 1 FROM comments reply JOIN comments target ON target.id=COALESCE(reply.reply_to,reply.parent_id) WHERE reply.id=? AND reply.submission=s.id AND target.submission=s.id AND target.user=p.user AND target.deleted=0)":'s.user=p.user'}`,job.submission,job.actor,job.subscription,job.submission,job.actor,now,...(job.kind==='reply'?[job.source]:[]));
  const exists=job.kind!=='reaction'?await one('SELECT id FROM comments WHERE id=? AND submission=? AND user=? AND deleted=0',job.source,job.submission,job.actor):await one('SELECT id FROM reactions WHERE submission=? AND user=? AND emoji=?',job.submission,job.actor,job.source);
  if(!sub||!exists){await run("UPDATE social_push SET status='skipped' WHERE id=?",job.id);continue}
  try{
   const status=await sendPush(sub,{title:job.kind==='reply'?'💬 Svar på kommentaren din':job.kind==='comment'?'💬 Ny kommentar':'❤️ Ny reaksjon',body:sub.actor_name+(job.kind==='reply'?' svarte på kommentaren din.':job.kind==='comment'?' har kommentert bildet ditt.':' reagerte '+job.source+' på bildet ditt.'),tag:job.id,url:'/?season='+encodeURIComponent(sub.season)+'&hunt='+encodeURIComponent(sub.challenge),kind:'social',expires:job.expires},Math.floor((job.expires-Date.now())/1000));
   if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run("UPDATE social_push SET status='expired' WHERE id=?",job.id)}
   else if(status>=200&&status<300){await run("UPDATE social_push SET status='sent',attempts=attempts+1 WHERE id=?",job.id);sent++}
   else{await run('UPDATE social_push SET attempts=attempts+1,next_attempt=? WHERE id=?',Date.now()+60000,job.id);failed++}
  }catch{await run('UPDATE social_push SET attempts=attempts+1,next_attempt=? WHERE id=?',Date.now()+60000,job.id);failed++}
 }
 return {sent,failed};
}

function audienceSqlForRecipient(){return `(s.user=p.user OR (s.user IN (SELECT id FROM members WHERE status='approved') AND ${peerAudienceSql('p.user','s.user')}))`;}
async function filterCommentSubscribers(subs:any[],source:string){const matching=await all('SELECT p.id FROM push_subscriptions p JOIN notification_preferences n ON n.user=p.user JOIN comments reply ON reply.id=? JOIN comments target ON target.id=COALESCE(reply.reply_to,reply.parent_id) WHERE target.user=p.user AND target.deleted=0 AND n.replies=1',source);const skip=new Set(matching.map((p:any)=>p.id));return subs.filter(p=>!skip.has(p.id));}
async function queueReply(submission:string,actor:string,source:string){const now=Date.now();const subs=await all(`SELECT p.id FROM comments reply JOIN comments target ON target.id=COALESCE(reply.reply_to,reply.parent_id) JOIN members m ON m.id=target.user JOIN notification_preferences n ON n.user=m.id JOIN push_subscriptions p ON p.user=m.id JOIN submissions s ON s.id=reply.submission WHERE reply.id=? AND reply.submission=? AND target.submission=reply.submission AND target.user!=? AND target.deleted=0 AND m.status='approved' AND n.replies=1 AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1') AND ${audienceSqlForRecipient()}`,source,submission,actor);if(subs.length)await db().batch(subs.map((p:any)=>db().prepare('INSERT OR IGNORE INTO social_push(id,subscription,submission,actor,kind,source,created,expires) VALUES(?,?,?,?,?,?,?,?)').bind('reply:'+p.id+':'+source,p.id,submission,actor,'reply',source,now,now+86400000)));}
