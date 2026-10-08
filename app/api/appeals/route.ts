import {member,origin,wrap,json} from '@/lib/server';
import {playerDecisions,createAppeal} from '@/lib/judging';
export const dynamic='force-dynamic';
export const GET=wrap(async()=>json({decisions:await playerDecisions((await member()).id)}));
export const POST=wrap(async(req:Request)=>{origin(req);return json(await createAppeal(await req.json(),(await member()).id));});
