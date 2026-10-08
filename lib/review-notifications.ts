import {all,one,run,db} from './server';
// The in-app notice is the decision itself. Push is an optional, deduplicated delivery.
export function reviewPushStatement(notice:string,submission:string,now:number,proof:string){
 return db().prepare(`INSERT OR IGNORE INTO review_push(id,notice,subscription,submission,created,expires) SELECT ?||':'||p.id,?,p.id,s.id,?,? FROM submissions s JOIN members m ON m.id=s.user JOIN push_subscriptions p ON p.user=m.id WHERE s.id=? AND m.status='approved' AND NOT EXISTS(SELECT 1 FROM settings WHERE key='push_disabled:'||m.id AND value='1') AND ${proof}`).bind(notice,notice,now,now+86400000,submission);
}
export async function dispatchReviewNotices(send:(sub:Record<string,unknown>,payload:Record<string,unknown>,ttl:number)=>Promise<number>){
 const now=Date.now();await run('DELETE FROM review_push WHERE expires<=?',now);let sent=0,failed=0;
 const jobs=await all("SELECT * FROM review_push WHERE status='pending' AND attempts<5 AND next_attempt<=? ORDER BY created LIMIT 20",now);
 for(const job of jobs){
  const sub=await one(`SELECT p.*,s.challenge,c.season FROM push_subscriptions p JOIN members m ON m.id=p.user JOIN submissions s ON s.user=m.id JOIN challenges c ON c.id=s.challenge WHERE p.id=? AND s.id=? AND m.status='approved' AND NOT EXISTS(SELECT 1 FROM settings WHERE key='push_disabled:'||m.id AND value='1')`,job.subscription,job.submission);
  const exists=job.notice.startsWith('appeal:')?await one("SELECT a.id FROM review_appeals a JOIN review_decisions d ON d.id=a.decision WHERE a.id=? AND a.status IN('approved','rejected') AND d.submission=?",job.notice.slice(7),job.submission):await one('SELECT id FROM review_decisions WHERE id=? AND submission=? AND current=1',job.notice.slice(9),job.submission);
  if(!sub||!exists){await run("UPDATE review_push SET status='skipped' WHERE id=?",job.id);continue;}
  try{const status=await send(sub,{title:'Foto Jakt',body:'En vurdering eller klagesak er avgjort. Åpne appen for å se resultatet.',tag:job.id,url:'/?season='+encodeURIComponent(sub.season)+'&hunt='+encodeURIComponent(sub.challenge),kind:'review',expires:job.expires},Math.floor((job.expires-now)/1000));
   if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run("UPDATE review_push SET status='expired' WHERE id=?",job.id);}
   else if(status>=200&&status<300){await run("UPDATE review_push SET status='sent',attempts=attempts+1 WHERE id=?",job.id);sent++;}
   else{await run('UPDATE review_push SET attempts=attempts+1,next_attempt=? WHERE id=?',now+60000,job.id);failed++;}
  }catch{await run('UPDATE review_push SET attempts=attempts+1,next_attempt=? WHERE id=?',now+60000,job.id);failed++;}
 }
 return {sent,failed};
}
