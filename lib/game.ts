import {all,one,run,db,fail,str} from './server';
import {osloDay,osloTime,nextDay} from './daily';
import {achievementsFrom} from './achievements';
import {requireHuntReview} from './hunt-review';
import {FIRST_LIGHTNING,LIGHTNING_DURATION,BONUS_REQUIREMENTS,rewardsFrom} from './game-rules';
import {env} from 'cloudflare:workers';
const weekOf=(n:number)=>{const day=osloDay(n),d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)};
export async function ensureGames(now=Date.now()){
 const week=weekOf(now);
 // Insert-once week key is the authority. Concurrent refreshes cannot reroll it.
 for(let i=0;i<5;i++){
  const monday=new Date(Date.parse(week+'T12:00:00Z')+i*7*86400000).toISOString().slice(0,10);
  if(await one('SELECT challenge FROM game_hunts WHERE week=?',monday))continue;
  const fixed=monday===weekOf(FIRST_LIGHTNING);
  const random=crypto.getRandomValues(new Uint32Array(3));
  const day=new Date(Date.parse(monday+'T12:00:00Z')+(random[0]%7)*86400000).toISOString().slice(0,10);
  let start=fixed?FIRST_LIGHTNING:osloTime(day,10+(random[1]%11))+(random[2]%60)*60000;
  if(!fixed&&start<now+1800000){
   const candidates:number[]=[];
   for(let offset=0;offset<7;offset++){
    const date=new Date(Date.parse(monday+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
    for(let hour=10;hour<=20;hour++){const candidate=osloTime(date,hour)+(random[2]%60)*60000;if(candidate>=now+1800000)candidates.push(candidate)}
   }
   if(!candidates.length)continue;start=candidates[random[1]%candidates.length];
  }
  const end=start+LIGHTNING_DURATION;
  const season=await one('SELECT id FROM seasons WHERE end IS NULL AND start<=? AND (last_day IS NULL OR last_day>=?) ORDER BY start DESC LIMIT 1',start,osloDay(start));
  if(!season)continue;
  const id='lightning:'+monday,word=['noe mykt','en kopp','noe rundt','en sko','noe blått'][random[2]%5];
  // Claim the week and insert its hunt atomically; deterministic ID makes retries safe.
  const d=(env as any).DB;
  const inserted=await d.batch([
   d.prepare('INSERT OR IGNORE INTO game_hunts(challenge,week,lightning) VALUES (?,?,1)').bind(id,monday),
   d.prepare("INSERT OR IGNORE INTO challenges(id,season,title,details,start,end,duration,created,daily,day,slot) SELECT ?,?,?,?,?,?,?,?,0,?,0 WHERE EXISTS(SELECT 1 FROM game_hunts WHERE challenge=?)").bind(id,season.id,word,'⚡ Lynjakt! Ta et nytt kamerabilde. Felles start, 20 minutter, egen toppliste. Gyldig bilde gir 1 bonuspoeng; vinneren får 3.',start,end,LIGHTNING_DURATION,now,osloDay(start),id)
  ]);
  if(fixed&&inserted[1].meta.changes){const stored=await one('SELECT start,end FROM challenges WHERE id=?',id);console.info('Lynjakt premiere persisted',JSON.stringify(stored));}
 }
 // Only unopened future normal hunts get an optional bonus. Existing words/times stay intact.
 const future=await all('SELECT c.id FROM challenges c WHERE c.daily=1 AND c.start>? AND NOT EXISTS(SELECT 1 FROM game_hunts g WHERE g.challenge=c.id) ORDER BY c.start LIMIT 100',now);
 for(const c of future){const roll=crypto.getRandomValues(new Uint32Array(1))[0];await run('INSERT OR IGNORE INTO game_hunts(challenge,bonus) VALUES (?,?)',c.id,roll%4===0?BONUS_REQUIREMENTS[roll%3]:null)}
}
export async function gameFor(user:string,now=Date.now()){
 const photos=await all(`SELECT s.*,c.start,c.end,c.day,c.slot,c.season,COALESCE(g.lightning,0) lightning,
  1+(SELECT COUNT(*) FROM submissions o WHERE o.challenge=s.challenge AND o.valid=1 AND (o.elapsed<s.elapsed OR (o.elapsed=s.elapsed AND (o.submitted<s.submitted OR (o.submitted=s.submitted AND o.id<s.id))))) place,
  NOT EXISTS(SELECT 1 FROM submissions o WHERE o.challenge=s.challenge AND o.valid=1 AND (o.submitted>s.submitted OR (o.submitted=s.submitted AND o.id>s.id))) last
  FROM submissions s JOIN challenges c ON c.id=s.challenge LEFT JOIN game_hunts g ON g.challenge=c.id WHERE s.user=? AND c.start<=?`,user,now);
 const hunts=await all('SELECT c.id,c.start,c.end,EXISTS(SELECT 1 FROM submissions s WHERE s.challenge=c.id AND s.user=? AND s.valid=1) valid FROM challenges c LEFT JOIN game_hunts g ON g.challenge=c.id JOIN members m ON m.id=? WHERE c.start<=? AND c.end>m.approved AND COALESCE(g.lightning,0)=0',user,user,now);
 const rivals=await all(`SELECT o.user,COUNT(*) wins FROM submissions s JOIN submissions o ON o.challenge=s.challenge AND o.user!=s.user JOIN challenges c ON c.id=s.challenge WHERE s.user=? AND s.valid=1 AND o.valid=1 AND c.end<=? AND (s.elapsed<o.elapsed OR (s.elapsed=o.elapsed AND (s.submitted<o.submitted OR (s.submitted=o.submitted AND s.id<o.id)))) GROUP BY o.user`,user,now);
 if(photos.length)photos[0].rivalWins=Math.max(0,...rivals.map((r:any)=>r.wins));
 const bonus=await all("SELECT b.*,s.challenge FROM bonus_reviews b JOIN submissions s ON s.id=b.submission WHERE s.user=?",user);
 const calculated=rewardsFrom(photos,achievementsFrom(photos.filter((p:any)=>!p.lightning),now,hunts),bonus.filter((b:any)=>b.status==='approved'&&photos.some((p:any)=>p.id===b.submission&&p.valid)).length,now);
 for(const award of [...calculated.titles.map((x:any)=>({...x,id:'title:'+x.id})),...calculated.secrets.map((x:any)=>({...x,id:'secret:'+x.id}))].filter(x=>x.earned))await run('INSERT OR IGNORE INTO game_awards(user,award,created) VALUES (?,?,?)',user,award.id,now);
 const awards=await all('SELECT award,created,seen FROM game_awards WHERE user=?',user);
 const earned=(id:string)=>awards.some((a:any)=>a.award===id);
 const active=(await one('SELECT value FROM settings WHERE key=?','active_title:'+user))?.value||'';
 return {titles:calculated.titles.map((t:any)=>({...t,earned:earned('title:'+t.id)})),active,
 secrets:calculated.secrets.map((s:any)=>earned('secret:'+s.id)?{...s,earned:true}:{id:s.id,title:'???',description:'',earned:false}),
 notices:awards.filter((a:any)=>!a.seen).map((a:any)=>{const secret=a.award.startsWith('secret:');const item=(secret?calculated.secrets:calculated.titles).find((x:any)=>x.id===a.award.split(':')[1]);if(!item)return null;return {id:a.award,title:secret?'🏆 Hemmelig achievement låst opp – '+item.title:'👑 Ny tittel – '+item.title,description:item.description}}).filter(Boolean),bonus};
}
export async function gameAction(b:any,user:string){
 if(b.action==='game-seen'){await run('UPDATE game_awards SET seen=1 WHERE user=? AND award=?',user,str(b.id,100));return {ok:true}}
 if(b.action==='active-title'){const id=typeof b.id==='string'?b.id:'';if(id&&!await one('SELECT award FROM game_awards WHERE user=? AND award=?',user,'title:'+id))fail('Lås opp tittelen først.',403);await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','active_title:'+user,id);return {ok:true}}
}
export async function activeTitles(){const rows=await all("SELECT key,value FROM settings WHERE key LIKE 'active_title:%'");const names:any={lightning:'Lynjegeren ⚡',master:'Fotomester 📸',speed:'Fartsdjevel 💨',streak:'Streak King 🔥',night:'Nattugla 🌙',veteran:'Veteran 🏆',creative:'Kreatøren 🎨'};return Object.fromEntries(rows.map((r:any)=>[r.key.slice(13),names[r.value]||'']))}
export async function processBonuses(now=Date.now()){
 await run("INSERT OR IGNORE INTO bonus_reviews(submission,status,reason,updated) SELECT s.id,'manual','Venter på manuell bonusvurdering.',? FROM submissions s JOIN game_hunts g ON g.challenge=s.challenge WHERE g.bonus IS NOT NULL AND s.valid=1 AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id)",now);
 const changed=await run("UPDATE bonus_reviews SET status='manual',reason='Venter på manuell bonusvurdering.',updated=?,lease=0 WHERE status='pending' AND EXISTS(SELECT 1 FROM submissions s WHERE s.id=bonus_reviews.submission AND s.valid=1) AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||bonus_reviews.submission)",now);
 return {processed:changed.meta.changes};
}
export async function bonusQueue(reviewer:string){return all("SELECT b.*,s.user,m.name,g.bonus,c.title FROM bonus_reviews b JOIN submissions s ON s.id=b.submission JOIN members m ON m.id=s.user JOIN challenges c ON c.id=s.challenge JOIN game_hunts g ON g.challenge=c.id WHERE b.status='manual' AND s.valid=1 AND c.start<=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?)) AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id) ORDER BY s.submitted",Date.now(),Date.now(),reviewer)}
export async function reviewBonus(b:any,reviewer:string){
 if(!['approved','rejected'].includes(b.status))fail('Velg godkjenn eller avslå.');const id=str(b.id,100),reason=str(b.reason,300),now=Date.now(),guard="SELECT 1 FROM bonus_reviews b JOIN submissions s ON s.id=b.submission WHERE b.submission=? AND b.status='manual' AND s.valid=1 AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id)";
 const submission=await one('SELECT challenge FROM submissions WHERE id=?',id);if(!submission)fail('Bildet finnes ikke.',404);await requireHuntReview(submission.challenge,reviewer);
 const results=await db().batch([
  db().prepare('INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS('+guard+')').bind('privacy-audit:'+now+':'+crypto.randomUUID(),JSON.stringify({actor:reviewer,action:'bonus-review',ids:[id],status:b.status,created:now}),id),
  db().prepare("UPDATE bonus_reviews SET status=?,reason=?,updated=?,lease=0 WHERE submission=? AND status='manual' AND EXISTS(SELECT 1 FROM submissions WHERE id=? AND valid=1) AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||bonus_reviews.submission)").bind(b.status,reason,now,id,id)
 ]);if(!results[1].meta.changes)fail('Bildet er endret eller allerede vurdert.',409);return {ok:true};
}
