import {all,one,run,db,fail,str} from './server';
import {normalizeWord} from './daily-words';
import {replaceWord} from './replace-word';
export const DIFFICULTY_DURATION=60*60000;
export async function openDifficultyPoll(b:any,actor:string,now=Date.now()){
 const id=str(b.id,100),word=normalizeWord(str(b.word,40));if(!/^[a-zæøå]+(?:[ -][a-zæøå]+){0,3}$/u.test(word))fail('Velg et trygt ord eller kort uttrykk på opptil fire ord.');
 const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL AND c.start<=? AND c.end>?',id,now,now+DIFFICULTY_DURATION);if(!c)fail('Avstemningen krever en pågående jakt med mer enn 60 minutter igjen.');
 if(c.revision!==Number(b.revision))fail('Jakten er endret. Last listen på nytt.',409);
 if(normalizeWord(c.title)===word||(await all('SELECT title FROM challenges WHERE id!=?',id)).some((r:any)=>normalizeWord(r.title)===word))fail('Velg et annet ord som ikke finnes i en annen jakt.');
 const poll=crypto.randomUUID();const d=db();const [inserted]=await d.batch([d.prepare("INSERT OR IGNORE INTO difficulty_polls(id,challenge,word,revision,actor,created,deadline) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM challenges WHERE id=? AND revision=? AND end>?) AND NOT EXISTS(SELECT 1 FROM difficulty_polls WHERE challenge=? AND status='open')").bind(poll,id,word,c.revision,actor,now,now+DIFFICULTY_DURATION,id,c.revision,now+DIFFICULTY_DURATION,id),d.prepare("INSERT INTO hunt_changes(id,challenge,user,revision,created,kind,poll) SELECT ?||':'||m.id,p.challenge,m.id,p.revision,p.created,'difficulty-poll',p.id FROM difficulty_polls p JOIN starts a ON a.challenge=p.challenge JOIN members m ON m.id=a.user AND m.status='approved' WHERE p.id=?").bind(poll,poll)]);if(!inserted.meta.changes)fail('En avstemning pågår allerede, eller jakten er endret.',409);return{ok:true};
}
export async function voteDifficulty(b:any,user:string,now=Date.now()){
 const id=str(b.id,100);if(!['replace','keep'].includes(b.choice))fail('Velg Bytt eller Behold.');
 const inserted=await run("INSERT OR IGNORE INTO difficulty_votes(poll,user,choice,created) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM difficulty_polls p JOIN challenges c ON c.id=p.challenge JOIN seasons s ON s.id=c.season JOIN members m ON m.id=? WHERE p.id=? AND p.status='open' AND p.deadline>? AND p.revision=c.revision AND c.end>? AND s.end IS NULL AND m.status='approved' AND EXISTS(SELECT 1 FROM starts a WHERE a.challenge=p.challenge AND a.user=m.id) AND NOT EXISTS(SELECT 1 FROM settings WHERE key='difficulty-settle:'||p.id AND CAST(value AS INTEGER)>?))",id,user,b.choice,now,user,id,now,now,now);if(!inserted.meta.changes)fail('Du har allerede stemt, eller avstemningen er avsluttet.',409);return{ok:true};
}
export async function visibleDifficultyPolls(user:string,now=Date.now()){
 return all("SELECT p.id,p.challenge,p.created,p.deadline,p.status,c.season,1 eligible,(SELECT choice FROM difficulty_votes WHERE poll=p.id AND user=?) mine,(SELECT COUNT(*) FROM difficulty_votes v JOIN members voter ON voter.id=v.user WHERE v.poll=p.id AND v.choice='replace' AND voter.status='approved') replaceVotes,(SELECT COUNT(*) FROM difficulty_votes v JOIN members voter ON voter.id=v.user WHERE v.poll=p.id AND v.choice='keep' AND voter.status='approved') keepVotes FROM difficulty_polls p JOIN challenges c ON c.id=p.challenge JOIN seasons s ON s.id=c.season JOIN members m ON m.id=? WHERE (EXISTS(SELECT 1 FROM starts a WHERE a.challenge=p.challenge AND a.user=m.id) OR (p.status!='open' AND EXISTS(SELECT 1 FROM hunt_changes n WHERE n.poll=p.id AND n.user=m.id))) AND s.end IS NULL AND c.start<=? AND p.created>? AND (p.status!='open' OR p.revision=c.revision) ORDER BY p.created DESC LIMIT 10",user,user,now,now-86400000);
}
export async function enrollDifficultyNotices(now=Date.now()){
 await run("INSERT OR IGNORE INTO hunt_changes(id,challenge,user,revision,created,kind,poll) SELECT p.id||':'||m.id,p.challenge,m.id,p.revision,?,'difficulty-poll',p.id FROM difficulty_polls p JOIN challenges c ON c.id=p.challenge AND c.revision=p.revision JOIN seasons s ON s.id=c.season JOIN starts a ON a.challenge=p.challenge JOIN members m ON m.id=a.user AND m.status='approved' WHERE p.status='open' AND p.deadline>? AND c.end>? AND s.end IS NULL",now,now,now);
}
export async function settleDifficultyPolls(now=Date.now()){
 await enrollDifficultyNotices(now);
 const polls=await all("SELECT p.*,c.revision currentRevision,c.end,s.end seasonEnd FROM difficulty_polls p LEFT JOIN challenges c ON c.id=p.challenge LEFT JOIN seasons s ON s.id=c.season WHERE p.status='open' AND (p.deadline<=? OR c.end<=? OR p.revision!=c.revision OR c.id IS NULL OR s.end IS NOT NULL)",now,now);
 for(const p of polls){const key='difficulty-settle:'+p.id,lease=String(now+30000),claimed=await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?',key,lease,now);if(!claimed.meta.changes)continue;
  try{
   if((await one('SELECT status FROM difficulty_polls WHERE id=?',p.id))?.status!=='open')continue;
   let status='kept';if(p.currentRevision!==p.revision||p.seasonEnd||p.end<=now||!p.end)status='superseded';else{
    const votes=await one("SELECT SUM(CASE WHEN v.choice='replace' THEN 1 ELSE 0 END) yes,SUM(CASE WHEN v.choice='keep' THEN 1 ELSE 0 END) no FROM difficulty_votes v JOIN members m ON m.id=v.user WHERE v.poll=? AND m.status='approved'",p.id);
    if((votes.yes||0)>(votes.no||0)){try{await replaceWord({id:p.challenge,word:p.word,revision:p.revision},p.actor,now);status='replaced'}catch(e:any){if(e.status===400||e.status===409){status='superseded'}else throw e}}
   }
   await run('UPDATE difficulty_polls SET status=? WHERE id=?',status,p.id);
  }finally{await run("UPDATE settings SET value='0' WHERE key=? AND value=?",key,lease)}
 }
}
