import {auditPrivacyRead} from '@/lib/privacy';
import {member,admin,one,bucket,wrap,fail} from '@/lib/server';
import {requireChatRoom} from '@/lib/chat-access';
import {flaggedChatMessage} from '@/lib/chat-media';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request,ctx:any)=>{const m=await member(),{id}=await ctx.params,x=await one('SELECT room,user,shared_photo FROM chat_messages WHERE id=?',id);if(!x)fail('Meldingen finnes ikke.',404);
 if(new URL(req.url).searchParams.get('review')==='1'){const reviewer=await admin(req);if(!await flaggedChatMessage(id))fail('Meldingen er ikke i vurderingskøen.',403);await auditPrivacyRead(reviewer.userId,'moderation-photo',[id]);}else{await requireChatRoom(x.room,m.id);if(!await one("SELECT id FROM members WHERE id=? AND status='approved'",x.user))fail('Bildet er utilgjengelig.',403)}
 const s=await one("SELECT s.key,s.user owner FROM submissions s JOIN challenges c ON c.id=s.challenge JOIN members m ON m.id=s.user WHERE s.id=? AND c.end<=? AND m.status='approved'",x.shared_photo,Date.now());if(!s||s.owner!==x.user)fail('Bildet er ikke tilgjengelig.',404);const f=await bucket().get(s.key);if(!f)fail('Bildet er utilgjengelig.',404);return new Response(f.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});
