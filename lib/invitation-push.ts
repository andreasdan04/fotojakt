import {all,one,run} from './server';
// The bell reads the invitation itself; this queue only handles optional push.
export async function queueInvitation(kind:'friend'|'group',source:string,recipient:string,actor:string,created:number){
 const column=kind==='friend'?'friends':'groups';
 await run(`INSERT OR IGNORE INTO invitation_push(id,subscription,recipient,actor,kind,source,created,expires)
 SELECT ?||':'||p.id,p.id,?,?,?,?,?,? FROM push_subscriptions p JOIN members m ON m.id=p.user LEFT JOIN notification_preferences n ON n.user=m.id
 WHERE p.user=? AND m.status='approved' AND COALESCE(n.${column},1)=1 AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1')`,kind+':'+source+':'+recipient+':'+created,recipient,actor,kind,source,created,created+86400000,recipient);
}
export async function dispatchInvitations(send:(sub:any,payload:any,ttl:number)=>Promise<number>){
 const now=Date.now();await run('DELETE FROM invitation_push WHERE expires<=?',now);let sent=0,failed=0;
 const jobs=await all("SELECT * FROM invitation_push WHERE status='pending' AND attempts<5 AND next_attempt<=? ORDER BY created LIMIT 20",now);
 for(const job of jobs){
  const column=job.kind==='friend'?'friends':'groups';
  const sub=await one(`SELECT p.*,a.name actorName FROM push_subscriptions p JOIN members m ON m.id=p.user JOIN members a ON a.id=? LEFT JOIN notification_preferences n ON n.user=m.id WHERE p.id=? AND p.user=? AND m.status='approved' AND a.status='approved' AND COALESCE(n.${column},1)=1 AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1')`,job.actor,job.subscription,job.recipient);
  const invitation=job.kind==='friend'?await one("SELECT created FROM friendships WHERE ((a=? AND b=?) OR (a=? AND b=?)) AND requester=? AND status='pending' AND created=?",job.actor,job.recipient,job.recipient,job.actor,job.actor,job.created):await one("SELECT g.name FROM group_invites i JOIN groups g ON g.id=i.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=i.inviter WHERE i.group_id=? AND i.user=? AND i.inviter=? AND i.created=? AND (g.owner=i.inviter OR issuer.role='admin') AND NOT EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=g.id AND gm.user=i.user)",job.source,job.recipient,job.actor,job.created);
  if(!sub||!invitation){await run("UPDATE invitation_push SET status='skipped' WHERE id=?",job.id);continue}
  try{
   const status=await send(sub,{title:job.kind==='friend'?'👋 Ny venneforespørsel':'👥 Gruppeinvitasjon',body:job.kind==='friend'?sub.actorName+' vil bli venn med deg.':sub.actorName+' inviterte deg til '+invitation.name+'.',url:'/?social=1',tag:job.id,kind:'invitation',expires:job.expires},Math.floor((job.expires-Date.now())/1000));
   if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run("UPDATE invitation_push SET status='expired' WHERE id=?",job.id)}
   else if(status>=200&&status<300){await run("UPDATE invitation_push SET status='sent',attempts=attempts+1 WHERE id=?",job.id);sent++}
   else{await retry(job.id);failed++}
  }catch{await retry(job.id);failed++}
 }
 return {sent,failed};
}
async function retry(id:string){await run('UPDATE invitation_push SET attempts=attempts+1,next_attempt=? WHERE id=?',Date.now()+60000,id)}
