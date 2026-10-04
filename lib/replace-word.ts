import {describeWords} from './word-descriptions';
import {all,one,run,db,fail,str} from './server';
import {normalizeWord} from './daily-words';
import {contentDeletionStatements,cleanDeletedPhotos} from './deletion';
import {notificationsEnabled} from './social-push';
export const POLL_OPEN_MESSAGE='Er jaktordet for vanskelig? Stem på forsiden om å bytte eller beholde. Avstemningen varer i 60 minutter. Ved bytte nullstilles bilder og tider for denne jakten.';
export const WORD_CHANGED_MESSAGE='Jaktordet er byttet på grunn av vanskelighetsgraden. Tidligere bilder og tider for denne jakten er nullstilt. Start jakten på nytt for å se det nye ordet.';
export async function replaceWord(b:any,actor:string,now=Date.now()){
 const id=str(b.id,100),word=normalizeWord(str(b.word,40));if(!/^[a-zæøå]+(?:[ -][a-zæøå]+){0,3}$/u.test(word))fail('Bruk et ord eller kort uttrykk på opptil fire ord.');
 const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL',id);if(!c||c.end&&c.end<=now)fail('Ord kan bare byttes i åpne eller fremtidige jakter.');
 if(Number(b.revision)!==c.revision)fail('Jakten er endret. Last listen på nytt før du bytter ord.',409);
 if(normalizeWord(c.title)===word)fail('Velg et annet ord.');
 if((await all('SELECT title FROM challenges WHERE id!=?',id)).some((r:any)=>normalizeWord(r.title)===word))fail('Ordet finnes allerede i en annen jakt. Velg et annet.');
 const description=(await describeWords([word]))[word];if(c.end&&c.end<=Date.now())fail('Jakten er avsluttet. Ordet kan ikke byttes.');const lock='replace-word-lock',lease=String(now+30000);const claimed=await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?',lock,lease,now);if(!claimed.meta.changes)fail('Et ordbytte pågår. Prøv igjen om litt.',409);
 try{
  const current=await one('SELECT revision FROM challenges WHERE id=?',id);if(current?.revision!==c.revision)fail('Jakten er endret. Last listen på nytt.',409);
  const count=(await one('SELECT COUNT(*) n FROM submissions WHERE challenge=?',id)).n;
  const d=db(),revision=c.revision+1,event=crypto.randomUUID();
  await d.batch([...contentDeletionStatements('reset',id),
   // Deliver a neutral notice to participants, never reveal either hunt word.
   d.prepare("INSERT INTO hunt_changes(id,challenge,user,revision,created) SELECT ?||':'||m.id,?,m.id,?,? FROM members m WHERE m.status='approved' AND ?<=? AND ( ?=1 OR m.approved<=?)").bind(event,id,revision,now,c.start||Number.MAX_SAFE_INTEGER,now,c.daily,c.start||now),
   d.prepare('UPDATE challenges SET title=?,details=?,revision=? WHERE id=? AND revision=?').bind(word,description,revision,id,c.revision),
   d.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('word-replacement:'+event,JSON.stringify({actor,challenge:id,revision,created:now,reason:'difficulty',removed:count}))
  ]);await cleanDeletedPhotos();return {ok:true,removed:count};
 }finally{await run("UPDATE settings SET value='0' WHERE key=? AND value=?",lock,lease)}
}
export async function dispatchWordChanges(sendPush:(sub:any,payload:any,ttl:number)=>Promise<number>){
 const now=Date.now(),notices=await all("SELECT n.*,vote.deadline voteDeadline,p.id subscription FROM hunt_changes n JOIN challenges c ON c.id=n.challenge AND c.revision=n.revision LEFT JOIN difficulty_polls vote ON vote.id=n.poll JOIN push_subscriptions p ON p.user=n.user JOIN members m ON m.id=n.user WHERE m.status='approved' AND (n.kind='word-change' OR (vote.status='open' AND vote.deadline>? AND EXISTS(SELECT 1 FROM starts a WHERE a.challenge=n.challenge AND a.user=n.user))) AND n.created>? AND p.created<=n.created ORDER BY n.created DESC",now,now-86400000);let sent=0,failed=0,attempted=0;
 for(const n of notices){const id=n.subscription+':word-change:'+n.id,previous=await one('SELECT * FROM push_deliveries WHERE id=?',id);if(previous&&(previous.status!=='pending'||previous.attempts>=5||previous.next_attempt>now))continue;
  await run("INSERT OR IGNORE INTO push_deliveries(id,subscription,challenge,kind,status,created) VALUES(?,?,?,?,'pending',?)",id,n.subscription,n.challenge,n.kind,now);
  const sub=await one("SELECT p.* FROM push_subscriptions p JOIN members m ON m.id=p.user JOIN challenges c ON c.id=? WHERE p.id=? AND p.user=? AND m.status='approved' AND c.revision=?",n.challenge,n.subscription,n.user,n.revision);
  if(!sub||!await notificationsEnabled(n.user)){await run("UPDATE push_deliveries SET status='skipped' WHERE id=?",id);continue}
  const expires=n.kind==='difficulty-poll'?n.voteDeadline:n.created+86400000;if(expires<=Date.now())continue;
  if(attempted++>=20)break;try{const status=await sendPush(sub,{title:n.kind==='difficulty-poll'?'📸 Ny avstemning om jaktord':'📸 Jaktordet er byttet',body:n.kind==='difficulty-poll'?POLL_OPEN_MESSAGE:WORD_CHANGED_MESSAGE,tag:'word-change:'+n.id,url:'/',kind:n.kind,expires},Math.ceil((expires-now)/1000));if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run("UPDATE push_deliveries SET status='expired' WHERE id=?",id)}else if(status>=200&&status<300){await run("UPDATE push_deliveries SET status='sent',attempts=attempts+1 WHERE id=?",id);sent++}else{await run('UPDATE push_deliveries SET attempts=attempts+1,next_attempt=? WHERE id=?',now+60000,id);failed++}}catch{await run('UPDATE push_deliveries SET attempts=attempts+1,next_attempt=? WHERE id=?',now+60000,id);failed++}
 }
 return {sent,failed};
}
