import {favoriteCandidate} from '@/lib/favorites';
import {member,bucket,wrap,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request,ctx:any)=>{const m=await member();const {token}=await ctx.params;const x=await favoriteCandidate(token,m.id);if(Date.now()<x.opens)fail('Avstemningen har ikke åpnet.',403);const f=await bucket().get(x.key);if(!f)fail('Bildet er utilgjengelig.',404);return new Response(f.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})});
