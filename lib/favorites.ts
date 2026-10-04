import {all,one,run,db,fail,str} from './server';
import {requirePhotoAudience,audienceSql} from './groups';
// Each group has a separate daily contest; no picture crosses a group boundary.
export async function prepareFavorites(viewer:string,now:number){
 const days=await all('SELECT c.season,c.day,MAX(c.end) opens FROM challenges c WHERE c.daily=1 AND c.slot IN (1,2) AND c.start IS NOT NULL GROUP BY c.season,c.day HAVING COUNT(DISTINCT c.slot)=2 AND MAX(c.end)<=? ORDER BY opens DESC LIMIT 32',now);
 const groups=await all('SELECT g.id,g.name FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user=?',viewer);
 for(const day of days)for(const group of groups){
  if(await one('SELECT id FROM favorite_polls WHERE group_id=? AND day=?',group.id,day.day))continue;
  const candidates=await all("SELECT s.id FROM submissions s JOIN challenges c ON c.id=s.challenge JOIN group_members gm ON gm.user=s.user JOIN members m ON m.id=s.user WHERE gm.group_id=? AND m.status='approved' AND c.season=? AND c.day=? AND c.slot IN (1,2) AND s.valid=1",group.id,day.season,day.day);
  if(!candidates.length)continue;
  const id=crypto.randomUUID(),d=db();await d.batch([d.prepare('INSERT OR IGNORE INTO favorite_polls(id,group_id,season,day,opens,closes) VALUES(?,?,?,?,?,?)').bind(id,group.id,day.season,day.day,day.opens,day.opens+86400000),...candidates.map((p:any)=>d.prepare('INSERT INTO favorite_candidates(token,poll,submission) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM favorite_polls WHERE id=?)').bind(crypto.randomUUID(),id,p.id,id))]);
 }
 const expired=await all('SELECT p.id FROM favorite_polls p JOIN group_members gm ON gm.group_id=p.group_id WHERE gm.user=? AND p.closes<=? AND p.settled=0',viewer,now);
 for(const p of expired){const d=db();await d.batch([
 d.prepare(`UPDATE favorite_candidates SET winner=1 WHERE poll=? AND EXISTS(SELECT 1 FROM submissions s JOIN members m ON m.id=s.user WHERE s.id=submission AND s.valid=1 AND m.status='approved') AND (SELECT COUNT(*) FROM favorite_votes v WHERE v.candidate=token)>0 AND (SELECT COUNT(*) FROM favorite_votes v WHERE v.candidate=token)=(SELECT MAX(n) FROM (SELECT COUNT(v.user) n FROM favorite_candidates x JOIN submissions s ON s.id=x.submission JOIN members m ON m.id=s.user LEFT JOIN favorite_votes v ON v.candidate=x.token WHERE x.poll=? AND s.valid=1 AND m.status='approved' GROUP BY x.token)) AND EXISTS(SELECT 1 FROM favorite_polls WHERE id=? AND settled=0)`).bind(p.id,p.id,p.id),
 d.prepare('UPDATE favorite_polls SET settled=1 WHERE id=? AND closes<=?').bind(p.id,now)]);}
}
export async function favoritesFor(viewer:string,now:number){
 await prepareFavorites(viewer,now);
 const polls=await all('SELECT p.*,g.name groupName FROM favorite_polls p JOIN groups g ON g.id=p.group_id JOIN group_members gm ON gm.group_id=p.group_id WHERE gm.user=? ORDER BY p.opens DESC LIMIT 64',viewer);
 const output=[];
 for(const p of polls){const closed=now>=p.closes;const vote=await one('SELECT candidate FROM favorite_votes WHERE poll=? AND user=?',p.id,viewer);
  const rows=await all(`SELECT x.token,x.winner,s.user,s.name,s.caption,(SELECT COUNT(*) FROM favorite_votes v WHERE v.candidate=x.token) votes FROM favorite_candidates x JOIN (SELECT s.*,m.name FROM submissions s JOIN members m ON m.id=s.user WHERE s.valid=1 AND m.status='approved') s ON s.id=x.submission WHERE x.poll=? AND ${audienceSql(viewer)} ORDER BY x.token`,p.id);
  output.push({id:p.id,day:p.day,groupName:p.groupName,opens:p.opens,closes:p.closes,closed,mine:vote?.candidate||null,candidates:rows.map((r:any)=>closed?{token:r.token,winner:!!r.winner,name:r.name,user:r.user,caption:r.caption,votes:r.votes}:{token:r.token,own:r.user===viewer})});
 }return output;
}
export async function favoriteCandidate(token:string,viewer:string){
 const x=await one('SELECT x.*,p.opens,p.closes,p.group_id,s.user,s.valid,s.key FROM favorite_candidates x JOIN favorite_polls p ON p.id=x.poll JOIN submissions s ON s.id=x.submission JOIN members m ON m.id=s.user WHERE x.token=? AND m.status=?',token,'approved');
 if(!x||!x.valid||!await one('SELECT user FROM group_members WHERE group_id=? AND user=?',x.group_id,viewer))fail('Bildet er ikke tilgjengelig for deg.',403);
 await requirePhotoAudience(x.submission,viewer);return x;
}
export async function voteFavorite(b:any,viewer:string,now:number){
 const x=await favoriteCandidate(str(b.token,100),viewer);if(now<x.opens||now>=x.closes)fail('Avstemningen er avsluttet eller ikke åpen.',409);if(x.user===viewer)fail('Du kan ikke stemme på ditt eget bilde.');
 const inserted=await run('INSERT OR IGNORE INTO favorite_votes(poll,user,candidate,created) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM favorite_polls WHERE id=? AND opens<=? AND closes>? AND settled=0)',x.poll,viewer,x.token,now,x.poll,now,now);
 if(!inserted.meta.changes)fail('Du har allerede stemt. Stemmen er låst.',409);return {ok:true};
}
