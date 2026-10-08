import {audienceSql,peerAudienceSql,requirePhotoAudience} from './groups';
import {all,one,db,fail,str} from './server';
// One review per photo. Freeze the electorate when opened so later registrations
// cannot change eligibility; each eligible member gets one immutable ballot.
export const PHOTO_REVIEW_MIN_VOTES=3;
export const PHOTO_REVIEW_DURATION=3*3600000;
export async function settleReports(now=Date.now()){
 const d=db();
 const count=(choice:string)=>`(SELECT COUNT(*) FROM photo_votes v WHERE v.submission=photo_reports.submission AND v.choice='${choice}')`;
 const total=`(${count('invalid')}+${count('valid')})`;
 const invalidMajority=`(${total}>=3 AND ${count('invalid')}*2>${total})`;
 const validMajority=`(${total}>=3 AND ${count('valid')}*2>${total})`;
 await d.batch([
  // Apply the new window to existing open reports as well.
  d.prepare("UPDATE photo_reports SET threshold=3,deadline=MIN(deadline,created+?) WHERE status='open' AND (threshold!=3 OR deadline>created+?)").bind(PHOTO_REVIEW_DURATION,PHOTO_REVIEW_DURATION),
  d.prepare(`UPDATE photo_reports SET status=CASE WHEN ${invalidMajority} THEN 'invalid' ELSE 'valid' END WHERE status='open' AND (deadline<=? OR ${invalidMajority} OR ${validMajority})`).bind(now),
  d.prepare("UPDATE submissions SET valid=0,note='Underkjent av deltakerne etter avstemning.' WHERE id IN (SELECT submission FROM photo_reports WHERE status='invalid' AND applied=0)"),
  d.prepare("UPDATE photo_reports SET applied=1 WHERE status!='open' AND applied=0")
 ]);
}
export async function visibleReports(viewer:string,isAdmin:boolean,now:number,season:string|null=null,profile:string|null=null){
 return all(`SELECT r.submission,r.reason,r.created,r.deadline,r.status,r.threshold,
 (SELECT COUNT(*) FROM photo_voters e WHERE e.submission=r.submission) electorate,
 (SELECT COUNT(*) FROM photo_votes v WHERE v.submission=r.submission AND v.choice='invalid') invalidVotes,
 (SELECT COUNT(*) FROM photo_votes v WHERE v.submission=r.submission AND v.choice='valid') validVotes,
 (SELECT choice FROM photo_votes v WHERE v.submission=r.submission AND v.user=?) mine,
 EXISTS(SELECT 1 FROM photo_voters e WHERE e.submission=r.submission AND e.user=?) eligible
 FROM photo_reports r JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge
 WHERE ${audienceSql(viewer)} AND (? IS NULL OR c.season=?) AND (? IS NULL OR s.user=?)
 AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) )`,viewer,viewer,season,season,profile,profile,now,viewer);
}
export async function reportAction(b:any,user:string,now:number){
 const id=str(b.id,100);await requirePhotoAudience(id,user);
 const photo=await one('SELECT s.* FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?))',id,now,user);
 if(!photo)fail('Lever ditt eget bilde først, eller vent til dagen er over.',403);
 if(photo.user===user)fail('Du kan ikke melde eller stemme på ditt eget bilde.',403);
 const d=db();
 if(b.action==='report-photo'){
  if(!photo.valid)fail('Bildet er allerede underkjent.');
  const reason=str(b.reason,300);
  if(await one('SELECT submission FROM photo_reports WHERE submission=?',id))fail('Dette bildet har allerede en avstemning.');
  await d.batch([
   d.prepare(`INSERT OR IGNORE INTO photo_reports(submission,reporter,reason,created,deadline,status,threshold,applied)
    SELECT s.id,?,?,?,?,'open',3,0 FROM submissions s WHERE s.id=? AND s.valid=1`).bind(user,reason,now,now+PHOTO_REVIEW_DURATION,id),
   d.prepare(`INSERT OR IGNORE INTO photo_voters(submission,user) SELECT r.submission,m.id FROM photo_reports r JOIN submissions s ON s.id=r.submission CROSS JOIN members m WHERE r.submission=? AND r.reporter=? AND r.created=? AND m.status='approved' AND m.id!=s.user AND ${peerAudienceSql('s.user','m.id')}`).bind(id,user,now)
  ]);
 }else{
  if(!['valid','invalid'].includes(b.choice))fail('Velg gyldig eller ugyldig.');
  const res=await d.prepare(`INSERT OR IGNORE INTO photo_votes(submission,user,choice,created)
   SELECT r.submission,?,?,? FROM photo_reports r JOIN photo_voters e ON e.submission=r.submission AND e.user=? WHERE r.submission=? AND r.status='open' AND r.deadline>?`).bind(user,b.choice,now,user,id,now).run();
  if(!res.meta.changes)fail('Du har allerede stemt, avstemningen er stengt, eller du har ikke stemmerett.');
 }
 await settleReports(now);return {ok:true};
}
