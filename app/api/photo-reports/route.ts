import {member,admin,origin,one,all,run,wrap,json,fail,str} from '@/lib/server';
import {requirePhotoAudience} from '@/lib/groups';
import {canReviewHunt} from '@/lib/hunt-review';
import {auditPrivacyRead} from '@/lib/privacy';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{origin(req);const m=await member(),b:any=await req.json(),id=str(b.id,100),reason=str(b.reason,300);await requirePhotoAudience(id,m.id);const s=await one('SELECT s.user,c.end FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?))',id,Date.now(),m.id);if(!s)fail('Lever ditt eget bilde først, eller vent til jakten er ferdig.',403);if(s.user===m.id)fail('Du kan ikke rapportere ditt eget bilde.',403);const saved=await run('INSERT OR IGNORE INTO photo_admin_reports(id,submission,reporter,reason,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,m.id,reason,Date.now());if(!saved.meta.changes)fail('Du har allerede rapportert dette bildet.',409);return json({ok:true})});
export const GET=wrap(async(req:Request)=>{
 const context=new URL(req.url).searchParams.get('context');
 if(context){const m=await member(),id=str(context,100);await requirePhotoAudience(id,m.id);const c=await one('SELECT c.title,c.details FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=? AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?))',id,Date.now(),m.id);if(!c)fail('Lever ditt eget bilde først, eller vent til jakten er ferdig.',403);return json(c)}
 const reviewer=await admin(req),now=Date.now();
 // Older clients report via the voting endpoint. Include those reports without
 // duplicating a photo that already has an open direct-to-admin report.
 const rows=await all(`SELECT r.id reportId,r.source,r.reason reportReason,r.created reportedAt,COALESCE(mr.name,'Slettet bruker') reporterName,s.id,s.user,s.valid,s.note,s.caption,mp.name,c.id challenge,c.title,c.details,c.start,c.end,EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) own
 FROM (SELECT id,submission,reporter,reason,created,'admin' source FROM photo_admin_reports WHERE status='open'
 UNION ALL SELECT 'vote:'||r.submission id,r.submission,r.reporter,r.reason,r.created,'vote' source FROM photo_reports r WHERE r.status!='admin' AND NOT EXISTS(SELECT 1 FROM photo_admin_reports direct WHERE direct.submission=r.submission AND direct.status='open')) r
 JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge LEFT JOIN members mr ON mr.id=r.reporter JOIN members mp ON mp.id=s.user ORDER BY r.created DESC,r.id`,reviewer.userId);
 const reports=rows.filter((r:any)=>canReviewHunt(r,!!r.own,now)).slice(0,100).map(({own,...r}:any)=>r);
 const lockedReports=rows.filter((r:any)=>!canReviewHunt(r,!!r.own,now)).slice(0,100).map((r:any)=>({reportId:r.reportId,reportedAt:r.reportedAt,end:r.end,lockedReason:r.start>now?'Jakten har ikke startet.':'Lever ditt eget bilde, eller vent til jaktens slutt.'}));
 await auditPrivacyRead(reviewer.userId,'photo-report-list',reports.map((r:any)=>r.id));return json({reports,lockedReports,total:rows.length,now});
});
