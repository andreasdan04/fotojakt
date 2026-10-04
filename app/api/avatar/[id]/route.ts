import {member,one,bucket,wrap,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request,ctx:any)=>{await member();const {id}=await ctx.params;const avatar=await one("SELECT a.key FROM avatars a JOIN members m ON m.id=a.user WHERE a.user=? AND m.status='approved'",id);if(!avatar)fail('Ingen profilbilde.',404);const file=await bucket().get(avatar.key);if(!file)fail('Bildet finnes ikke.',404);return new Response(file.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})});
