import {reviewPushStatement} from './review-notifications';
import {all,one,db,fail,str} from './server';
import {staffGuard,type StaffRole} from './staff';
import {requireHuntReview} from './hunt-review';
import {auditPrivacyRead} from './privacy';
export type ReviewInput={kind?:string;id?:string;status?:string;reason?:string;override?:boolean;decision?:string;expectedValid?:boolean;expectedNote?:string;administrative?:boolean;elapsed?:number;approve?:boolean;action?:string};
export type Reviewer={userId:string;role:StaffRole;sessionToken:string};
export async function judgingQueue(actor:Reviewer){
 const args=[actor.userId,Date.now(),Date.now(),actor.userId];
 const visible="s.user<>? AND c.start<=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?))";
 const bonus=await all(`SELECT s.id submission,'bonus' kind,c.title,c.details,s.caption,g.bonus,b.reason FROM bonus_reviews b JOIN submissions s ON s.id=b.submission JOIN challenges c ON c.id=s.challenge JOIN game_hunts g ON g.challenge=c.id WHERE b.status='manual' AND s.valid=1 AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id) AND ${visible} ORDER BY s.submitted LIMIT 100`,...args);
 const photos=await all(`SELECT s.id submission,'photo' kind,c.title,c.details,s.caption,s.valid expectedValid,s.note expectedNote,(SELECT reason FROM photo_admin_reports r WHERE r.submission=s.id AND r.status='open' ORDER BY r.created LIMIT 1) reportReason,(SELECT reason FROM photo_reports r WHERE r.submission=s.id AND r.status!='admin') voteReason,(SELECT id FROM review_decisions d WHERE d.submission=s.id AND d.kind='photo' AND d.current=1) decision FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE (EXISTS(SELECT 1 FROM photo_admin_reports r WHERE r.submission=s.id AND r.status='open') OR EXISTS(SELECT 1 FROM photo_reports r WHERE r.submission=s.id AND r.status!='admin')) AND ${visible} ORDER BY s.submitted LIMIT 100`,...args);
 const history=await all("SELECT d.id,d.submission,d.kind,d.status,d.reason,d.created,d.current,c.title FROM review_decisions d JOIN submissions s ON s.id=d.submission JOIN challenges c ON c.id=s.challenge WHERE d.actor=? ORDER BY d.created DESC,d.id DESC LIMIT 100",actor.userId);
 const canAppeal=['owner','head_judge'].includes(actor.role);
 const decisions=canAppeal?await all(`SELECT d.id decision,d.submission,d.kind,d.reason,d.status,c.title,c.details,s.caption,g.bonus,s.valid expectedValid,s.note expectedNote FROM review_decisions d JOIN submissions s ON s.id=d.submission JOIN challenges c ON c.id=s.challenge LEFT JOIN game_hunts g ON g.challenge=c.id WHERE d.current=1 AND ${visible} AND NOT EXISTS(SELECT 1 FROM review_appeals WHERE decision=d.id AND status='open') ORDER BY d.created DESC LIMIT 100`,...args):[];
 const appeals=['owner','head_judge','administrator'].includes(actor.role)?await all(`SELECT a.id,a.reason,a.created,a.status,d.id decision,d.kind,d.submission,d.reason decisionReason,c.title,c.details,g.bonus,s.caption,CASE WHEN d.actor=? OR s.user=? THEN 1 ELSE 0 END conflict FROM review_appeals a JOIN review_decisions d ON d.id=a.decision JOIN submissions s ON s.id=d.submission JOIN challenges c ON c.id=s.challenge LEFT JOIN game_hunts g ON g.challenge=c.id WHERE a.status='open' AND c.start<=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?)) ORDER BY a.created LIMIT 100`,actor.userId,actor.userId,Date.now(),Date.now(),actor.userId):[];
 await auditPrivacyRead(actor.userId,'judge-case-list',[...bonus,...photos].map(r=>r.submission));return {bonus,photos,history,appeals,decisions,canAppeal,role:actor.role};
}
export async function decideCase(b:ReviewInput,actor:Reviewer){
 const kind=b.kind==='photo'?'photo':b.kind==='bonus'?'bonus':null;if(!kind)fail('Velg en gyldig sak.');
 const id=str(b.id,100),status=b.status;if(status!=='approved'&&status!=='rejected')fail('Velg godkjenn eller avslå.');
 const reason=status==='rejected'||b.override?str(b.reason,500):typeof b.reason==='string'&&b.reason.trim()?str(b.reason,500):'Kravene er oppfylt.';
 const s=await one('SELECT * FROM submissions WHERE id=?',id);if(!s)fail('Bildet finnes ikke.',404);if(s.user===actor.userId)fail('Du kan ikke dømme ditt eget bilde.',403);
 const hunt=await requireHuntReview(s.challenge,actor.userId);
 if(b.elapsed!==undefined&&(actor.role!=='owner'||!b.administrative||!Number.isFinite(b.elapsed)||b.elapsed<0||b.elapsed>hunt.end-hunt.start))fail('Ugyldig resultatkorrigering.',403);
 const previous=await one('SELECT * FROM review_decisions WHERE submission=? AND kind=? AND current=1',id,kind);
 if(previous&&!b.override)fail('Bildet er allerede vurdert. Hoveddommer kan omgjøre avgjørelsen.',409);
 if(b.override&&!['owner','head_judge'].includes(actor.role))fail('Bare hoveddommer eller eier kan omgjøre en avgjørelse.',403);
 if(b.override&&(!previous||previous.id!==b.decision))fail('Avgjørelsen er endret.',409);
 if(previous&&await one("SELECT id FROM review_appeals WHERE decision=? AND status='open'",previous.id))fail('Behandle den åpne klagen først.',409);
 if(kind==='photo'&&(typeof b.expectedValid!=='boolean'||typeof b.expectedNote!=='string'))fail('Hent bildet på nytt før vurdering.');
 if(b.administrative&&!['owner','administrator'].includes(actor.role))fail('Bare administrator og eier kan åpne andre bildesaker.',403);
 const now=Date.now(),decision=crypto.randomUUID(),guard=staffGuard(actor.userId,actor.sessionToken,b.override?['owner','head_judge']:b.administrative?['owner','administrator']:undefined);
 let eligible=kind==='bonus'?"EXISTS(SELECT 1 FROM bonus_reviews b JOIN submissions s ON s.id=b.submission WHERE b.submission=? AND b.status=? AND s.valid=1 AND s.user<>? AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id))":"EXISTS(SELECT 1 FROM submissions WHERE id=? AND valid=? AND COALESCE(note,'')=? AND user<>?)";
 const eligibility:unknown[]=kind==='bonus'?[id,b.override?(await one('SELECT status FROM bonus_reviews WHERE submission=?',id))?.status:'manual',actor.userId]:[id,b.expectedValid?1:0,b.expectedNote,actor.userId];
 if(kind==='photo'&&!b.override&&!b.administrative){eligible+=" AND (EXISTS(SELECT 1 FROM photo_admin_reports WHERE submission=? AND status='open') OR EXISTS(SELECT 1 FROM photo_reports WHERE submission=? AND status!='admin'))";eligibility.push(id,id);}
 eligible+=" AND NOT EXISTS(SELECT 1 FROM review_appeals a JOIN review_decisions d ON d.id=a.decision WHERE d.submission=? AND d.kind=? AND d.current=1 AND a.status='open')";eligibility.push(id,kind);
 eligible+=previous?" AND EXISTS(SELECT 1 FROM review_decisions WHERE id=? AND current=1)":" AND NOT EXISTS(SELECT 1 FROM review_decisions WHERE submission=? AND kind=? AND current=1)";eligibility.push(...(previous?[previous.id]:[id,kind]));
 const claim='privacy-audit:'+decision,proof=`EXISTS(SELECT 1 FROM settings WHERE key='${claim}')`,d=db();
 const q=[d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE ${guard.sql} AND ${eligible}`).bind(claim,JSON.stringify({actor:actor.userId,action:'judge-decision',ids:[id],decision,kind,status,created:now}),...guard.args,...eligibility),d.prepare(`UPDATE review_decisions SET current=0 WHERE submission=? AND kind=? AND current=1 AND ${proof}`).bind(id,kind),d.prepare(`INSERT INTO review_decisions(id,submission,kind,actor,status,reason,created) SELECT ?,?,?,?,?,?,? WHERE ${proof}`).bind(decision,id,kind,actor.userId,status,reason,now)];
 if(kind==='bonus')q.push(d.prepare(`UPDATE bonus_reviews SET status=?,reason=?,updated=?,lease=0 WHERE submission=? AND ${proof}`).bind(status,reason,now,id));
 else q.push(d.prepare(`UPDATE submissions SET valid=?,note=?,elapsed=COALESCE(?,elapsed) WHERE id=? AND ${proof}`).bind(status==='approved'?1:0,reason,b.elapsed??null,id),d.prepare(`UPDATE photo_reports SET status='admin',applied=1 WHERE submission=? AND ${proof}`).bind(id),d.prepare(`UPDATE photo_admin_reports SET status='resolved',resolved_at=? WHERE submission=? AND status='open' AND ${proof}`).bind(now,id));
 q.push(reviewPushStatement('decision:'+decision,id,now,proof));
 const result=await d.batch(q);if(!result[0].meta.changes)fail('Saken eller tilgangen er endret. Oppdater før du vurderer.',409);return {ok:true,decision};
}
export async function playerDecisions(user:string){return all(`SELECT d.id,d.submission,d.kind,d.status,d.reason,d.created,a.id appeal,a.status appealStatus,a.reason appealReason,a.resolution,a.resolved FROM review_decisions d JOIN submissions s ON s.id=d.submission LEFT JOIN review_appeals a ON a.decision=d.id WHERE s.user=? AND d.current=1 ORDER BY d.created DESC`,user);}
export async function createAppeal(b:ReviewInput,user:string){
 const decision=str(b.decision,100),reason=str(b.reason,1000),now=Date.now();
 const result=await db().prepare(`INSERT OR IGNORE INTO review_appeals(id,decision,user,reason,created) SELECT ?,d.id,?,?,? FROM review_decisions d JOIN submissions s ON s.id=d.submission WHERE d.id=? AND d.current=1 AND d.status='rejected' AND s.user=? AND (d.kind='photo' AND s.valid=0 OR d.kind='bonus' AND s.valid=1 AND EXISTS(SELECT 1 FROM bonus_reviews b WHERE b.submission=s.id AND b.status='rejected') AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id))`).bind(crypto.randomUUID(),user,reason,now,decision,user).run();
 if(!result.meta.changes)fail('Avgjørelsen kan ikke påklages, eller du har allerede sendt en klage.',409);return {ok:true};
}
export async function resolveAppeal(b:ReviewInput,actor:Reviewer){
 if(!['owner','head_judge'].includes(actor.role))fail('Bare hoveddommer eller eier kan behandle klager.',403);
 const id=str(b.id,100),reason=str(b.reason,1000);if(typeof b.approve!=='boolean')fail('Velg godkjenn eller avslå klagen.');
 const a=await one('SELECT a.*,d.actor originalActor,d.submission,d.kind,d.status decisionStatus,d.current,s.user photoOwner FROM review_appeals a JOIN review_decisions d ON d.id=a.decision JOIN submissions s ON s.id=d.submission WHERE a.id=?',id);
 if(!a)fail('Klagen finnes ikke.',404);if(a.originalActor===actor.userId||a.photoOwner===actor.userId)fail('Du er inhabil i denne klagen.',403);
 await requireHuntReview((await one('SELECT challenge FROM submissions WHERE id=?',a.submission)).challenge,actor.userId);
 const now=Date.now(),guard=staffGuard(actor.userId,actor.sessionToken,['owner','head_judge']),d=db(),claim='privacy-audit:'+crypto.randomUUID(),proof=`EXISTS(SELECT 1 FROM settings WHERE key='${claim}')`;
 const result=await d.batch([
  d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE ${guard.sql} AND EXISTS(SELECT 1 FROM review_appeals ra JOIN review_decisions rd ON rd.id=ra.decision JOIN submissions s ON s.id=rd.submission WHERE ra.id=? AND ra.status='open' AND rd.current=1 AND rd.status='rejected' AND COALESCE(rd.actor,'')<>? AND s.user<>? AND (rd.kind='photo' AND s.valid=0 OR rd.kind='bonus' AND s.valid=1 AND EXISTS(SELECT 1 FROM bonus_reviews b WHERE b.submission=s.id AND b.status='rejected') AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id)))`).bind(claim,JSON.stringify({actor:actor.userId,action:'resolve-appeal',appeal:id,approved:b.approve,created:now}),...guard.args,id,actor.userId,actor.userId),
  d.prepare(`UPDATE review_appeals SET status=?,reviewer=?,resolution=?,resolved=? WHERE id=? AND ${proof}`).bind(b.approve?'approved':'rejected',actor.userId,reason,now,id),
  d.prepare(`UPDATE bonus_reviews SET status=CASE WHEN ? THEN 'approved' ELSE 'rejected' END,reason=?,updated=?,lease=0 WHERE submission=? AND ?='bonus' AND ${proof}`).bind(b.approve?1:0,reason,now,a.submission,a.kind),
  d.prepare(`UPDATE submissions SET valid=CASE WHEN ? THEN 1 ELSE 0 END,note=? WHERE id=? AND ?='photo' AND ${proof}`).bind(b.approve?1:0,reason,a.submission,a.kind),
  reviewPushStatement('appeal:'+id,a.submission,now,proof)
 ]);
 if(!result[0].meta.changes)fail('Klagen, bildet eller tilgangen er endret. Oppdater siden.',409);return {ok:true};
}
export async function casePhotoAccess(id:string,actor:Reviewer){
 const s=await one('SELECT * FROM submissions WHERE id=?',id);if(!s)fail('Bildet finnes ikke.',404);if(s.user===actor.userId)fail('Du kan ikke vurdere ditt eget bilde.',403);
 const appeal=await one("SELECT a.id,d.actor FROM review_appeals a JOIN review_decisions d ON d.id=a.decision WHERE d.submission=? AND a.status='open' AND d.current=1",id);
 const queued=await one(`SELECT s.id FROM submissions s WHERE s.id=? AND (EXISTS(SELECT 1 FROM bonus_reviews b WHERE b.submission=s.id AND b.status='manual' AND s.valid=1 AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||s.id)) OR EXISTS(SELECT 1 FROM photo_admin_reports WHERE submission=s.id AND status='open') OR EXISTS(SELECT 1 FROM photo_reports WHERE submission=s.id AND status!='admin'))`,id);
 if(appeal&&['owner','head_judge','administrator'].includes(actor.role)){if(appeal.actor===actor.userId)fail('En annen hoveddommer må behandle klagen.',403);await requireHuntReview(s.challenge,actor.userId);}
 else {if(!queued&&!(['owner','head_judge'].includes(actor.role)&&await one('SELECT id FROM review_decisions WHERE submission=? AND current=1',id)))fail('Bildet er ikke en tilgjengelig vurderingssak.',403);await requireHuntReview(s.challenge,actor.userId);}
 await auditPrivacyRead(actor.userId,'judge-case-photo',[id]);return s;
}
