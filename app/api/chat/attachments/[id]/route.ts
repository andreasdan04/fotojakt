import {member,admin,origin,one,run,db,bucket,wrap,json,fail} from '@/lib/server';
import {requireChatRoom} from '@/lib/chat-access';
import {flaggedChatMessage} from '@/lib/chat-media';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request,ctx:any)=>{
 const m=await member(),{id}=await ctx.params,a=await one('SELECT a.*,x.user sender FROM chat_attachments a LEFT JOIN chat_messages x ON x.id=a.message WHERE a.id=?',id);if(!a)fail('Vedlegget finnes ikke.',404);
 if(new URL(req.url).searchParams.get('review')==='1'){await admin(req);if(!a.message||!await flaggedChatMessage(a.message))fail('Vedlegget er ikke i vurderingskøen.',403)}
 else {await requireChatRoom(a.room,m.id);if(!a.message&&a.user!==m.id)fail('Vedlegget er ikke tilgjengelig.',403);if(a.message&&!await one("SELECT id FROM members WHERE id=? AND status='approved'",a.sender))fail('Vedlegget er ikke tilgjengelig.',403);}
 const f=await bucket().get(a.key);if(!f)fail('Vedlegget er utilgjengelig.',404);const image=a.mime.startsWith('image/');return new Response(f.body,{headers:{'Content-Type':a.mime,'Content-Disposition':(image?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(a.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
});
export const DELETE=wrap(async(req:Request,ctx:any)=>{origin(req);const m=await member(),{id}=await ctx.params,a=await one('SELECT * FROM chat_attachments WHERE id=? AND user=? AND message IS NULL',id,m.id);if(!a)fail('Vedlegget finnes ikke.',404);await db().batch([db().prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:chat:'||id,key FROM chat_attachments WHERE id=? AND user=? AND message IS NULL").bind(id,m.id),db().prepare('DELETE FROM chat_attachments WHERE id=? AND user=? AND message IS NULL').bind(id,m.id)]);return json({ok:true});});
