import {admin,one,all,db,origin,wrap,json,fail,str} from '@/lib/server';
import {canReviewHunt,requireHuntReview} from '@/lib/hunt-review';
import {auditPrivacyRead} from '@/lib/privacy';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{
 origin(req);const reviewer=await admin(req),b:any=await req.json(),id=str(b.id,100);
 if(typeof b.valid!=='boolean'||typeof b.expectedValid!=='boolean'||typeof b.expectedNote!=='string')fail('Ugyldig vurdering.');
 const categories:any={word:'Passer ikke ordet',rules:'Bryter reglene',other:'Annet',restore:'Godkjent på nytt'};
 if(!categories[b.category]||b.valid&&b.category!=='restore'||!b.valid&&b.category==='restore')fail('Velg årsak til vurderingen.');
 const reason=str(b.reason,240),note=categories[b.category]+': '+reason;
 const s=await one('SELECT challenge FROM submissions WHERE id=?',id);if(!s)fail('Innleveringen finnes ikke lenger.',404);
 await requireHuntReview(s.challenge,reviewer.userId);
 const guard='SELECT 1 FROM submissions WHERE id=? AND valid=? AND COALESCE(note,\'\')=?',args=[id,b.expectedValid?1:0,b.expectedNote];
 const now=Date.now(),audit={actor:reviewer.userId,action:'hunt-submission-review',ids:[id],valid:b.valid,category:b.category,created:now};
 const result=await db().batch([
  db().prepare('INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS('+guard+')').bind('privacy-audit:'+now+':'+crypto.randomUUID(),JSON.stringify(audit),...args),
  db().prepare("UPDATE photo_reports SET status='admin',applied=1 WHERE submission=? AND EXISTS("+guard+')').bind(id,...args),
  db().prepare("UPDATE photo_admin_reports SET status='resolved',resolved_at=? WHERE submission=? AND status='open' AND EXISTS("+guard+')').bind(now,id,...args),
  db().prepare('UPDATE submissions SET valid=?,note=? WHERE id=? AND valid=? AND COALESCE(note,\'\')=?').bind(b.valid?1:0,note,...args)
 ]);
 if(!result[3].meta.changes)fail('Innleveringen er endret av noen andre. Oppdater og vurder på nytt.',409);
 return json({ok:true,id,valid:b.valid?1:0,note});
});
export const GET=wrap(async(req:Request)=>{
 const reviewer=await admin(req),q=new URL(req.url).searchParams,now=Date.now(),challenge=q.get('challenge');
 if(!challenge){
  const seasons=await all('SELECT id,name,start,end FROM seasons ORDER BY start DESC');
  const selected=q.get('season');if(selected&&!seasons.some((s:any)=>s.id===selected))fail('Albumet finnes ikke.',404);
  const season=seasons.find((s:any)=>s.id===selected)||seasons.find((s:any)=>s.start<=now&&!s.end)||seasons[0]||null;
  const rows=season?await all('SELECT c.id,c.title,c.start,c.end,c.day,c.daily,COALESCE(g.lightning,0) lightning,(SELECT COUNT(*) FROM submissions WHERE challenge=c.id) count,EXISTS(SELECT 1 FROM submissions WHERE challenge=c.id AND user=?) own FROM challenges c LEFT JOIN game_hunts g ON g.challenge=c.id WHERE c.season=? AND c.start IS NOT NULL ORDER BY c.start DESC,c.id',reviewer.userId,season.id):[];
  return json({seasons,season:season?.id||null,now,hunts:rows.map((c:any)=>{const canReview=canReviewHunt(c,!!c.own,now);return {...c,title:canReview?c.title:c.lightning?'Hemmelige lynjaktord':'Hemmelige jaktord',canReview,lockedReason:canReview?null:c.start>now?'Jakten har ikke startet.':'Lever ditt eget bilde, eller vent til jaktens slutt.'}})});
 }
 const c=await requireHuntReview(str(challenge,100),reviewer.userId,now),user=q.get('user');
 const filter=user?' AND s.user=?':'';const args:any[]=[c.id,...(user?[str(user,100)]:[])];
 let cursor='';if(q.get('before')){const match=/^(\d{1,16}):([A-Za-z0-9:._-]{1,100})$/.exec(q.get('before')!);if(!match||!Number.isSafeInteger(Number(match[1])))fail('Ugyldig side.');cursor=' AND (s.submitted<? OR (s.submitted=? AND s.id<?))';args.push(Number(match[1]),Number(match[1]),match[2]);}
 const rows=await all(`SELECT s.id,s.user,s.submitted,s.elapsed,s.valid,s.note,s.caption,m.name,m.username,m.status,st.started FROM submissions s JOIN members m ON m.id=s.user LEFT JOIN starts st ON st.challenge=s.challenge AND st.user=s.user WHERE s.challenge=?${filter}${cursor} ORDER BY s.submitted DESC,s.id DESC LIMIT 37`,...args);
 const items=rows.slice(0,36).map((s:any)=>({...s,started:c.daily?s.started:c.start,registeredPhotoTime:(c.daily?s.started:c.start)?(c.daily?s.started:c.start)+s.elapsed:null}));
 const participants=await all('SELECT DISTINCT m.id,m.name,m.username FROM submissions s JOIN members m ON m.id=s.user WHERE s.challenge=? ORDER BY m.name,m.id',c.id);
 const total=await one(`SELECT COUNT(*) count FROM submissions s WHERE s.challenge=?${filter}`,c.id,...(user?[user]:[]));
 await auditPrivacyRead(reviewer.userId,'hunt-submission-list',items.map((s:any)=>s.id));
 return json({challenge:{id:c.id,title:c.title,details:c.details,start:c.start,end:c.end},items,participants,total:total.count,hasMore:rows.length>36,nextBefore:rows.length>36?items.at(-1).submitted+':'+items.at(-1).id:null,now});
});
