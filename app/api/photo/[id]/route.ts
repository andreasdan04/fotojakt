import {auditPrivacyRead} from '@/lib/privacy';
import {requirePhotoAudience} from '@/lib/groups';
import {requireHuntReview} from '@/lib/hunt-review';
import {member,admin,staff,one,bucket,wrap,fail} from '@/lib/server';
import {casePhotoAccess} from '@/lib/judging';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request,ctx:any)=>{
 const m=await member(),{id}=await ctx.params,review=new URL(req.url).searchParams.get('review');
 if(review==='case'){const s=await casePhotoAccess(id,await staff(req)),file=await bucket().get(s.key);if(!file)fail('Bildet er utilgjengelig.',404);return new Response(file.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 if(review==='hunt'){
  const reviewer=await staff(req),s=await one('SELECT challenge,key FROM submissions WHERE id=?',id);if(!s)fail('Bildet finnes ikke.',404);
  await requireHuntReview(s.challenge,reviewer.userId);
  const file=await bucket().get(s.key);if(!file)fail('Bildet er utilgjengelig.',404);
  await auditPrivacyRead(reviewer.userId,'hunt-submission-photo',[id]);
  return new Response(file.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(review==='bonus'){const reviewer=await admin(req);if(!await one("SELECT submission FROM bonus_reviews WHERE submission=? AND status='manual' AND EXISTS(SELECT 1 FROM settings WHERE key='bonus-opt:'||submission)",id))fail('Bildet er ikke i bonuskøen.',403);await auditPrivacyRead(reviewer.userId,'bonus-photo',[id]);}else await requirePhotoAudience(id,m.id);
 const s=await one('SELECT s.*,c.end FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=?',id);if(!s)fail('Bildet finnes ikke.',404);
 if(review==='bonus')await requireHuntReview(s.challenge,m.id);
 const own=await one('SELECT id FROM submissions WHERE challenge=? AND user=?',s.challenge,m.id);
 if(!own&&s.end>Date.now())fail('Bildene er skjult til du har levert eller jakten er ferdig.',403);
 const f=await bucket().get(s.key);if(!f)fail('Bildet er utilgjengelig.',404);
 return new Response(f.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});
